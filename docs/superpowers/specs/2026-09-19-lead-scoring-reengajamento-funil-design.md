# Lead Scoring + Reengajamento + Funil do Motor — Design

## Objetivo

Três melhorias no motor de prospecção:

1. **Lead Scoring** — priorizar leads que já interagiram (respondeu WPP, atendeu ligação) sobre leads frios
2. **Reengajamento automático** — leads esgotados recebem 4 WPPs espaçados antes de serem descartados definitivamente
3. **Dashboard de funil** — melhorar `/prospeccao/motor` com funil completo, taxas de conversão e filtro por período

## 1. Lead Scoring

### Colunas novas em `leads_gerados`

- `score` (integer, default 0) — pontuação calculada por eventos

### Tabela de pontos

| Sinal | Pontos |
|-------|--------|
| Respondeu WPP (lead mandou msg na conversa) | +30 |
| Atendeu ligação (IA ou PD) | +20 |
| Dropado no Power Dialer (quase atendeu) | +15 |
| Google rating >= 4.0 | +10 |
| Tem website | +5 |

### Onde o score é atualizado

- **Respondeu WPP**: no webhook `api/webhooks/wpp/twilio/incoming` quando `autor = "lead"` e conversa tem `lead_gerado_id`
- **Atendeu ligação IA**: no `src/lib/voz-ia/post-call.ts` quando `status = "atendida"`
- **Atendeu/Dropado PD**: no `src/app/api/power-dialer/conference-event/[batchId]/route.ts` (`handleFirstAnswer`)
- **Google rating + website**: no momento da criação do lead (gerador-leads) — score inicial calculado em batch

### Alteração em `selecionarLeads`

```
ORDER BY
  dropado_power_dialer DESC,
  score DESC,               ← NOVO
  ai_tentativas ASC,
  google_rating DESC,
  created_at ASC
```

### Score inicial (backfill)

Migration roda um UPDATE que seta score baseado nos dados existentes:
- `+10` se `google_rating >= 4.0`
- `+5` se `website IS NOT NULL`
- Não tenta reconstruir respondeu_wpp/atendeu_ligacao do histórico (complexo demais, score zero é ok pra leads antigos)

## 2. Reengajamento Automático

### Colunas novas em `leads_gerados`

- `reengajamento_tentativas` (integer, default 0)
- `reengajamento_proxima` (timestamptz, nullable)

### Cadência de reengajamento

| Tentativa | Dias após anterior |
|-----------|-------------------|
| 1ª | +10 dias após esgotado |
| 2ª | +25 dias |
| 3ª | +45 dias |
| 4ª | +10 dias |

Após a 4ª sem resposta → `ai_status = 'descartado_definitivo'`.

### Fluxo no motor

Após o loop principal de leads (que já existe), o motor faz uma **segunda passada**:

1. Seleciona leads com:
   - `ai_status = 'esgotado'`
   - `reengajamento_tentativas < 4`
   - `reengajamento_proxima IS NOT NULL`
   - `reengajamento_proxima <= now()`
   - mesma org, mesma checagem de horário comercial
   - `wppRestante > 0`

2. Para cada lead:
   - Manda WPP com prompt de reengajamento (template diferente do primeiro contato)
   - Incrementa `reengajamento_tentativas`
   - Seta `reengajamento_proxima` baseado na tabela de intervalos
   - Se `reengajamento_tentativas = 4` → `ai_status = 'descartado_definitivo'`
   - Loga em `motor_prospeccao_log` com `acao = 'reengajamento_wpp'`

3. Limite: até 5 reengajamentos por run do motor (não sobrecarregar)

### Trigger de reengajamento

Quando `processarLead` marca um lead como `esgotado`, além de setar `ai_status = 'esgotado'`, também:
- `reengajamento_proxima = now() + 10 dias`
- `reengajamento_tentativas = 0`

### Se o lead responder durante reengajamento

No webhook WPP incoming, se o lead tem `ai_status = 'esgotado'` e responde:
- `ai_status` → `'aguardando'`
- `reengajamento_tentativas` → mantém (não reseta)
- `ai_tentativas` → mantém
- A IA responde normalmente e a cadência retoma do ponto atual

### Valor de `ai_status` novo

Adicionar `'descartado_definitivo'` ao CHECK constraint de `ai_status`.

## 3. Dashboard de Funil

### Melhorias na página `/prospeccao/motor`

#### Filtro por período
Toggle: 7 dias / 30 dias / 90 dias / Tudo. Default: 30 dias.

#### Funil completo
Dados vindos de `motor_prospeccao_log` + `leads_gerados`:

1. **Na fila** — leads com `status IN (novo, em_contato, qualificado)` e `ai_status` disponível
2. **WPP enviados** — count de `acao = 'wpp_primeiro_contato'` no período
3. **Responderam** — count de conversas WPP onde o lead respondeu (autor = 'lead') no período
4. **Ligações feitas** — count de `acao IN ('ligacao_ia')` + ligações PD no período
5. **Atenderam** — count de ligações com `status = 'atendida'` no período
6. **Reunião agendada** — count de `acao = 'reuniao_agendada'` no período
7. **Virou cliente** — count de leads que mudaram `status` para `'cliente'` no período

#### Taxas de conversão
Entre cada etapa: "WPP → Respondeu: 12%", "Ligação → Atendeu: 35%", etc.

#### Card de reengajamento
- Total reengajados (último período)
- Responderam ao reengajamento
- Taxa de recuperação

#### KPIs mantidos
Os 4 cards atuais (WPP hoje, conversas ativas, reuniões semana, taxa resposta) ficam.

### Queries

Nova função `getFunilMotorPorPeriodo(orgId, dias)` que substitui `getFunilMotor`:
- Usa `motor_prospeccao_log` filtrado por `criado_em >= now() - interval`
- Junta com `ligacoes` pra dados de atendimento
- Junta com `leads_gerados` pra conversão final
- Cacheado com `unstable_cache` (60s, tag `motor-funil`)

## Migration

Uma única migration com:
1. `ALTER TABLE leads_gerados ADD COLUMN score integer DEFAULT 0`
2. `ALTER TABLE leads_gerados ADD COLUMN reengajamento_tentativas integer DEFAULT 0`
3. `ALTER TABLE leads_gerados ADD COLUMN reengajamento_proxima timestamptz`
4. Backfill de score baseado em google_rating e website
5. Adicionar `'descartado_definitivo'` ao CHECK constraint de `ai_status`
6. Adicionar `'reengajamento_wpp'` como acao válida no `motor_prospeccao_log` (se houver constraint)
