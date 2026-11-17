# Power Dialer — Modo Lucas

**Data:** 2026-09-18  
**Status:** Aprovado

## Resumo

Novo modo de ligação no motor de prospecção: o sistema dispara 2-3 ligações simultâneas e, quando alguém atende, conecta o Lucas instantaneamente via Twilio Conference. A IA ("Ana") serve apenas como recepcionista para segurar o lead enquanto o Lucas entra.

**Separado do Modo Ana** — são dois modos independentes no motor. O Modo Ana continua funcionando como hoje (IA faz a conversa inteira). O Modo Lucas é o power dialer descrito aqui.

---

## Fluxo Principal

### 1. Discagem em Batch

O motor (cron a cada ~5 min) seleciona 2-3 leads da fila e liga pra todos simultaneamente via Twilio REST API.

- Cada ligação cria uma **Conference Room** única (`pd-{batchId}`)
- Sem AMD (Answering Machine Detection) — atendeu = dispara notificação pro Lucas imediatamente
- O motor dispara **o tempo todo** em horário comercial, independente de o Lucas estar online ou não. O Lucas vai estar atento (celular com PWA ou computador).

### 2. Lead Atende

Quando qualquer lead atende:

1. **Ana (TTS)** fala imediatamente: *"Olá, tudo bem? Só um momento..."* (~3-4 segundos)
2. Lead entra na Conference Room
3. Sistema identifica que é o **primeiro lead a atender** nesse batch

### 3. Notificação Instantânea pro Lucas

No mesmo instante em que o lead atende:

- **Som de alerta** no navegador (ring curto)
- **Toast/banner visual** com dados do lead (nome, empresa, nicho, cidade)
- **Push notification do navegador** (funciona em outra aba ou com navegador minimizado)
- **Push notification PWA** no celular (se o site está salvo na tela inicial)
- **Chamada Twilio** pro Device do Lucas para ele entrar na Conference

### 4. Lucas Entra na Conference

**Se online (Device registrado):** o Twilio Device do Lucas auto-aceita a chamada e entra na Conference. Zero clique necessário — ele só começa a falar: *"Olá, tudo bem? Aqui é o Lucas da Yide..."*

**Se no celular (PWA aberta):** mesmo fluxo, Device no navegador mobile funciona igual.

**Se offline:** push notification avisa, ele abre o sistema, Device registra e aceita. Delay de ~5-10s.

### 5. Leads Dropados

Os outros leads que atenderam simultaneamente mas não foram o primeiro:
- Ouvem: *"Desculpe, vamos retornar em breve, obrigada!"*
- Ligação desligada
- **Voltam pra fila com prioridade** (flag `dropado_power_dialer = true`, `ai_proxima_tentativa = agora`)

### 6. Timeout de 15 Segundos

Se o Lucas não entra na Conference em 15s:
- Ana fala: *"Desculpe, vamos retornar em breve, obrigada!"*
- Ligação desligada
- Lead volta pra fila com prioridade

### 7. Pós-Ligação

Quando a ligação termina (Lucas desliga ou lead desliga):
- **Gravação** salva automaticamente (Conference recording)
- **IA gera resumo** da conversa (transcrição via Whisper → resumo via GPT)
- Resultado salvo no histórico do lead
- Espelhado na tabela `ligacoes` com `origem: "power_dialer"`
- Sistema inicia o **próximo batch automaticamente**

---

## Arquitetura Técnica

### Conference Bridge (Twilio)

Cada batch usa uma Conference Room do Twilio:

**TwiML do lead (outbound):**
```xml
<Response>
  <Say language="pt-BR" voice="Polly.Vitoria-Neural">
    Olá, tudo bem? Só um momento...
  </Say>
  <Conference
    startConferenceOnEnter="true"
    endConferenceOnExit="false"
    record="record-from-start"
    recordingStatusCallback="/api/power-dialer/recording/{batchId}"
    statusCallback="/api/power-dialer/conference-event/{batchId}"
    statusCallbackEvent="join leave end">
    pd-{batchId}
  </Conference>
</Response>
```

**TwiML do Lucas (incoming ao Device):**
```xml
<Response>
  <Conference
    startConferenceOnEnter="true"
    endConferenceOnExit="true"
    beep="false">
    pd-{batchId}
  </Conference>
</Response>
```

Lucas tem `endConferenceOnExit: true` — quando ele desliga, a conference encerra.

### Incoming Calls no Twilio Device

Hoje o `VoiceGrant` tem `incomingAllow: false`. Para o power dialer:
- Mudar para `incomingAllow: true` quando o usuário tem role `socio` ou config de power dialer
- No `TwilioCallProvider`, adicionar handler para `device.on("incoming")` que **auto-aceita** quando em modo power dialer
- A identidade do Device (UUID do Lucas) é usada pelo server pra direcionar a call

### Presença / Online Detection

O `TwilioCallProvider` já envolve todas as páginas (layout autenticado global). Para detectar se o Lucas está online:

- Quando o Device registra: `device.on("registered")` → atualizar flag no banco (`colaboradores.power_dialer_online = true`)
- Quando o Device desconecta: `device.on("unregistered")` → limpar flag
- Heartbeat periódico (a cada 60s) para cobrir edge cases
- O motor **NÃO** checa essa flag para decidir se dispara (dispara sempre). A flag é usada apenas para métricas/dashboard.

### PWA + Push Notifications

Para notificações no celular:
- **Service Worker** para receber push notifications
- **Web App Manifest** para "Add to Home Screen"
- Usar **Web Push API** (VAPID keys) para enviar push do server
- O push inclui dados do lead (nome, empresa) para contexto imediato

### Motor — Nova Função `dispararPowerDialer()`

Similar a `dispararLigacaoIA()` mas:
- Cria 2-3 calls simultaneamente (em paralelo)
- Usa TwiML de Conference (não Media Stream/OpenAI)
- Sem AMD
- Gerencia o batch (qual lead atendeu primeiro, cancelar os outros)

### Seleção de Leads

Reutiliza a lógica de `selecionarLeads()` existente com ajustes:
- Leads com `dropado_power_dialer = true` têm prioridade máxima
- Batch size = 3 (configurável em `ai_voice_configs`)
- Mesmos filtros de status, tentativas, horário

---

## Novas Rotas API

| Rota | Método | Função |
|------|--------|--------|
| `/api/power-dialer/twiml/[batchId]/lead` | POST | TwiML para calls outbound (Ana + Conference) |
| `/api/power-dialer/twiml/[batchId]/agent` | POST | TwiML para Lucas entrar na Conference |
| `/api/power-dialer/conference-event/[batchId]` | POST | Webhook de eventos da Conference (join/leave/end) |
| `/api/power-dialer/recording/[batchId]` | POST | Webhook de gravação pronta |
| `/api/power-dialer/status/[batchId]` | POST | Status callback das outbound calls |
| `/api/power-dialer/presence` | POST | Heartbeat de presença do Device |

---

## Mudanças no Banco de Dados

### Tabela `ai_voice_configs` — novos campos

```sql
ALTER TABLE ai_voice_configs
  ADD COLUMN power_dialer_ativo boolean DEFAULT false,
  ADD COLUMN power_dialer_batch_size integer DEFAULT 3,
  ADD COLUMN power_dialer_timeout_s integer DEFAULT 15,
  ADD COLUMN power_dialer_colaborador_id uuid REFERENCES colaboradores(id),
  ADD COLUMN power_dialer_greeting text DEFAULT 'Olá, tudo bem? Só um momento...',
  ADD COLUMN power_dialer_goodbye text DEFAULT 'Desculpe, vamos retornar em breve, obrigada!';
```

### Nova tabela `power_dialer_batches`

```sql
CREATE TABLE power_dialer_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  conference_name text NOT NULL,
  status text NOT NULL DEFAULT 'discando',
    -- discando | conectado | timeout | concluido | erro
  lead_atendeu_id uuid REFERENCES leads_gerados(id),
  colaborador_id uuid NOT NULL REFERENCES colaboradores(id),
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  conectado_em timestamptz,
  finalizado_em timestamptz,
  duracao_segundos integer,
  gravacao_url text,
  resumo_ia text,
  transcricao jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE power_dialer_batch_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES power_dialer_batches(id) ON DELETE CASCADE,
  lead_gerado_id uuid NOT NULL REFERENCES leads_gerados(id),
  twilio_call_sid text,
  status text NOT NULL DEFAULT 'discando',
    -- discando | atendeu | dropado | nao_atendeu | ocupado | erro
  atendeu_em timestamptz,
  finalizado_em timestamptz,
  created_at timestamptz DEFAULT now()
);
```

### Campo em `leads_gerados`

```sql
ALTER TABLE leads_gerados
  ADD COLUMN dropado_power_dialer boolean DEFAULT false;
```

---

## Componentes UI

### Modificações no `TwilioCallProvider`

- `incomingAllow: true` no VoiceGrant (server-side)
- Handler `device.on("incoming")`: auto-aceita quando `powerDialerMode = true`
- Novo estado: `powerDialerMode` (ativo quando há config de power dialer)
- Tocar som de alerta ao receber incoming call

### Novo componente: `PowerDialerNotification`

Toast/banner flutuante que aparece quando um lead atende:
- Nome do lead, empresa, nicho, cidade
- Indicador de status (conectando → em ligação)
- Botão "Desligar" e "Pular" (desliga e vai pro próximo batch)
- Timer mostrando duração da ligação

### Configuração no `/voz-ia`

Toggle "Power Dialer" na página de configuração com:
- Ativo/inativo
- Quem atende (seletor de colaborador — Lucas)
- Tamanho do batch (2-3)
- Timeout (15s padrão)
- Frase de cumprimento da Ana
- Frase de despedida (timeout/dropado)

---

## Integração com Motor

No `worker.ts`, ao processar lead com step de `ligacao`:

```
if (config.power_dialer_ativo) {
  // Acumula leads do batch (2-3)
  // Quando batch cheio → dispararPowerDialer()
} else {
  // Fluxo existente → dispararLigacaoIA()
}
```

O motor continua processando leads sequencialmente para WhatsApp e acumula leads de ligação em batches de 2-3 para o power dialer.

---

## Pontos de Atenção

1. **Twilio Conference pricing**: cada Conference leg é cobrada separadamente. Com 2-3 leads + Lucas = 3-4 legs por batch.
2. **Recording**: a gravação da Conference captura todo mundo. O resumo IA processa só o áudio pós-conexão do Lucas.
3. **Concorrência**: o motor deve garantir que não haja dois batches ativos simultaneamente para o mesmo colaborador.
4. **Leads dropados**: voltar pra fila com `dropado_power_dialer = true` para prioridade máxima no próximo batch.
5. **PWA**: necessário configurar service worker + manifest + VAPID keys para push no celular.
