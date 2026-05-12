# Reuniões — Fase 5: realtime + retenção LGPD

Fecha o módulo: UI atualiza ao vivo enquanto a IA processa + cron diário apaga gravações vencidas (LGPD compliance).

## Realtime na página de detalhe

Quando você acabou de subir um áudio (ou recebeu da Fase 4 do bot), a página de detalhe fica aberta enquanto Whisper transcreve (~30s) e Claude resume (~10s).

**Antes:** você ficava dando F5.

**Agora:** `MeetingRealtimeWatcher` assina mudanças em 4 tabelas filtradas pelo `meeting_id`:
- `meetings` (status, flags ready)
- `meeting_transcripts` (Whisper terminou)
- `meeting_summaries` (Claude terminou)
- `meeting_extracted_tasks` (tasks geradas/aceitas)

Quando qualquer uma muda, dispara `router.refresh()` automático.

E pra deixar bonito, o **`ProcessingBanner`** mostra um pipeline visual de 4 etapas (Gravação → Transcrição → Resumo+Tópicos → Insights+Tarefas) com barra de progresso global. Cada etapa fica:
- Verde com check quando pronta
- Amber pulsando quando é a atual
- Cinza quando ainda não chegou

Banner some sozinho quando tudo termina.

## Retenção LGPD (90 dias)

### Política
Gravações de reunião são apagadas **90 dias** depois da data da reunião. Mas:
- ✅ `meetings` mantém (titulo, datas, owner — histórico do time)
- ✅ `meeting_transcripts` mantém (texto curado, não tem dado biométrico)
- ✅ `meeting_summaries` mantém (resumo + decisões + insights)
- ✅ `meeting_extracted_tasks` mantém
- ❌ **Só a gravação MP3/MP4** é deletada (arquivo no Storage + row em `meeting_recordings`)

Isso atende LGPD (gravação é o dado sensível) e mantém a memória útil do time.

### Override manual

Coluna `meetings.retencao_override`:
- `null` (default): usa retenção padrão (`starts_at + 90 dias`)
- Data futura distante (ex.: `2099-12-31`): "manter pra sempre"
- Data customizada: estende ou reduz a retenção dessa reunião

Pra futuro: botão na UI "Reter permanentemente" / "Apagar agora" setando essa coluna.

### Como o cron funciona

`/api/cron/cleanup-old-recordings` (rode diariamente 4h UTC = 1h BRT):
1. Consulta view `meeting_recordings_to_cleanup` (calcula retenção efetiva: `coalesce(retencao_override, retain_until)`)
2. Pra cada gravação vencida (max 50/run):
   - Apaga arquivo do Storage bucket
   - DELETE da row em `meeting_recordings`
   - UPDATE `meetings.recording_ready = false` (pra UI saber)
3. Invalida cache `meetings`
4. Retorna JSON com `{deleted, errors, resultados[]}`

Idempotente — pode rodar várias vezes sem problema.

### Migration

```sql
-- supabase/migrations/20260515000000_reunioes_retencao.sql
```

Adiciona:
- `meetings.retain_until` (generated column, `starts_at + interval '90 days'`)
- `meetings.retencao_override` (timestamptz, override manual)
- view `meeting_recordings_to_cleanup`
- index `idx_meetings_retain_until`

Migration é independente — não quebra nada das fases anteriores.

## Setup (3 min)

### Passo 1 — Aplicar migration
Junto com as outras pendentes:
```bash
npm run db:push
```
ou via Supabase MCP / SQL Editor.

### Passo 2 — Verificar cron no vercel.json
Já incluído neste PR. Próximo deploy ativa automaticamente.

### Passo 3 — Validar
- Abrir uma reunião em `/reunioes/[id]` recém-criada (sem transcript ainda)
- Banner amarelo "IA processando…" aparece no topo
- Quando Whisper terminar (~30s), etapa "Transcrição" vira verde
- Quando Claude terminar (~10s depois), "Resumo+Tópicos" e "Insights+Tarefas" viram verde
- Banner some sozinho
- Sem F5 manual

Pra forçar o cron de cleanup manualmente:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://sistemaacompanha.yidedigital.com.br/api/cron/cleanup-old-recordings
```

## Recomendação pra LGPD

Atualize o template do convite de reunião comercial com:

> _Esta reunião pode ser gravada para fins de qualidade de atendimento, registro de acordos e geração de tarefas internas. **A gravação fica restrita à equipe da Yide e é apagada após 90 dias.** O resumo textual gerado por IA é mantido por tempo indeterminado pra histórico de relacionamento._

Pra compliance forte (clientes corporativos exigentes), considere:
- Pedir consentimento explícito no início da call (verbal ou visual)
- Adicionar página `/reunioes/{id}/transparencia` com aviso pra participantes externos pedirem delete sob demanda
- Cron mensal de auditoria que loga quantas gravações foram deletadas no mês

## Tabelas finais (sem mudanças além de meetings)

```
meetings           ──┐
meeting_recordings   │
meeting_transcripts  ├─ tudo mantido nas Fases 0-3
meeting_summaries    │
meeting_extracted_tasks
meeting_processing_jobs ┘
meetings.retain_until        ← novo (generated)
meetings.retencao_override   ← novo (manual)
meeting_recordings_to_cleanup ← novo (view)
```

## Status final do módulo Reuniões

| Fase | PR | Status |
|---|---|---|
| 0 — UI shell + schema | #243 | ✅ mergeado |
| 1 — Google OAuth + Calendar | #244 | aberto |
| 2 — Upload + Whisper | #245 | aberto |
| Perf — Groq (9× barato) | #247 | aberto |
| 3 — IA Haiku (resumo + insights + tasks) | #246 | aberto |
| **5 — Realtime + retenção LGPD** | **#248** (este) | **aberto** |

Fase 4 (bot Recall.ai entrando no Meet automaticamente) — não implementada, opcional. Custa ~R$ 250/mês a 50 reuniões/h. Pra MVP, upload manual da Fase 2 é suficiente.

Quando todos os PRs mergearem + as 3 migrations rodarem + os 3 env vars setados (`GOOGLE_OAUTH_*`, `GROQ_API_KEY`, `ANTHROPIC_API_KEY`), você tem o tl;dv interno pronto.
