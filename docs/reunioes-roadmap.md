# Reuniões — Roadmap & decisões pendentes

> Inspirado em tl;dv. Objetivo: capturar reunião Google Meet → gravar → transcrever → gerar resumo/insights/tarefas via IA → salvar histórico.

## Status atual (Fase 0 — UI shell)

Esta Fase entrega **a "casa"**: UI premium funcional usando mock data + schema SQL preparado pra todas as fases + stubs de integração com contratos definidos. Nada toca API externa ainda.

**Entregue:**

- ✅ Migration SQL `20260513000000_reunioes_fase1.sql` cobrindo `meetings`, `meeting_participants`, `meeting_recordings`, `meeting_transcripts`, `meeting_summaries`, `meeting_extracted_tasks`, `meeting_processing_jobs`, `google_oauth_connections`
- ✅ Tipos TS em `src/lib/reunioes/tipos.ts`
- ✅ Queries em `src/lib/reunioes/queries.ts` (mock por enquanto, contrato estável)
- ✅ Stubs com docstrings: `google/oauth.ts`, `google/calendar.ts`, `transcription/whisper.ts`, `ai/summarizer.ts`
- ✅ Mock data realista (4 reuniões + 1 detalhada com transcrição/resumo/insights/tasks completos)
- ✅ Página `/reunioes` — lista com KPIs, filtros, busca, banner "conectar Google"
- ✅ Página `/reunioes/[id]` — detalhe com player, header, tabs (Resumo / Tópicos / Transcrição / Insights / Tarefas)
- ✅ Página `/reunioes/conectar` — placeholder do flow OAuth
- ✅ Página `/reunioes/metricas` — dashboard com ranking, status, mapa da semana, tags
- ✅ Item no Sidebar (grupo Comercial)

**A migration NÃO foi aplicada ainda.** Revisar e aplicar via Supabase MCP ou `npm run db:push` quando estiver tudo OK.

## Decisões pendentes (bloqueiam Fase 1+)

Estas decisões precisam ser tomadas antes de implementar as próximas fases. Cada uma tem impacto grande em custo, complexidade ou legalidade.

### 1. Como gravar a reunião?

| Opção | Como funciona | Custo | Complexidade | Recomendação |
|---|---|---|---|---|
| **Recall.ai** (provider SaaS) | API que entra como bot, retorna áudio + transcrição | ~$0.50-1.00 por hora de reunião | Baixíssima | ✅ pra MVP rápido |
| **Self-hosted bot** (Puppeteer) | Headless Chrome entra como participante | Server cost | Alta + risco de quebra ToS Google | ❌ frágil |
| **Upload manual** | User grava localmente, faz upload | Só transcrição | Baixa | ✅ pra começar barato |
| **Chrome extension** | Captura via WebRTC dentro do Meet | Dev time alto | Alta | ❌ requer instalação |

**Sugestão**: começar com **upload manual** (Fase 2 simplificada). Quando funcionar, plugar **Recall.ai** pra auto-join (Fase 4) se vale o custo.

### 2. Quem conecta Google?

- **Cada colaborador conecta sua própria conta** (1 token por user)
- **Conta master única da Yide** (todos compartilham)

**Sugestão**: cada colaborador conecta a própria. RLS já tá pronta pra isso (`unique(user_id)` em `google_oauth_connections`).

### 3. Provider de transcrição

| Provider | Custo | Diarização nativa | Idiomas |
|---|---|---|---|
| **Whisper API** (OpenAI) | $0.006/min (~$0.36/h) | ❌ não | excelente PT-BR |
| **AssemblyAI** | $0.37/h | ✅ sim | bom PT-BR |
| **Deepgram Nova-2** | $0.43/h | ✅ sim | bom PT-BR |
| **Recall.ai built-in** | incluído no custo do Recall | ✅ sim | bom |

**Sugestão**: Whisper API. Mais barato, qualidade ótima. Pra diarização (separar speakers), pedimos pro Claude inferir do contexto — funciona razoavelmente bem em reuniões pequenas (2-4 pessoas).

### 4. Storage de gravações

- **Supabase Storage**: $0.021/GB. Pra 100 reuniões/mês × 50MB = 5GB = ~$0.10/mês. Suave.
- **Cloudflare R2**: mais barato a escala (sem egress fees)
- **S3**: padrão de mercado, custos previsíveis

**Sugestão**: Supabase Storage. Já temos credenciais, integração simples. Migrar se passar de 100GB.

### 5. LGPD / consentimento

Gravar reunião sem aviso pode violar LGPD/CLT. Precisa:

- [ ] Aviso visual no início da call ("Esta reunião está sendo gravada")
- [ ] Consentimento documentado dos participantes
- [ ] Política de retenção (quanto tempo guarda? 90 dias?)
- [ ] Botão "apagar minha gravação" pra participantes externos

## Roadmap por fase

### Fase 1 — Google OAuth + Calendar sync (3-4 dias)

**Objetivo**: usuário conecta conta Google, sistema lista reuniões agendadas/passadas do Calendar.

- [ ] Configurar projeto no Google Cloud Console
- [ ] Variáveis `.env`: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`
- [ ] Implementar `buildAuthorizeUrl`, `exchangeCodeForTokens`, `refreshAccessToken` em `src/lib/reunioes/google/oauth.ts`
- [ ] Criar API route `/api/auth/google-callback`
- [ ] Implementar `listEvents` e `incrementalSync` em `src/lib/reunioes/google/calendar.ts`
- [ ] Cron de 5min sincronizando reuniões pra `meetings`
- [ ] Trocar `listMeetings()` em `queries.ts` por SELECT real

### Fase 2 — Upload manual + transcrição (2-3 dias)

**Objetivo**: usuário faz upload de áudio MP3/M4A de reunião, sistema transcreve.

- [ ] Botão "Upload áudio" na página de detalhe da reunião
- [ ] Server action que aceita arquivo, salva em `meeting_recordings`, cria job em `meeting_processing_jobs`
- [ ] Edge function (Supabase) processa job: baixa áudio do Storage, chama Whisper API, salva em `meeting_transcripts`
- [ ] Variável `.env`: `OPENAI_API_KEY`

### Fase 3 — Resumo + insights + tarefas via Claude (2 dias)

**Objetivo**: depois da transcrição, IA gera resumo executivo, tópicos com timestamps, decisões, próximos passos, insights e tarefas candidatas.

- [ ] Implementar `summarizeMeeting` em `src/lib/reunioes/ai/summarizer.ts`
- [ ] Prompts especializados pra cada tipo de output (4 calls em paralelo)
- [ ] Cron picka jobs em `pending` de `summarization` e processa
- [ ] UI dos botões "Aceitar tarefa" / "Descartar" funcionando (insere em `tasks` se aceito)
- [ ] Cria edge function `process-meeting` que orquestra: transcrição → resumo → insights → tasks

### Fase 4 — Bot auto-join via Recall.ai (3-5 dias)

**Objetivo**: bot entra automaticamente nas reuniões agendadas, sem upload manual.

- [ ] Conta no Recall.ai (~$200/mês setup + $0.50-1/hora reunião)
- [ ] Variável `.env`: `RECALL_API_KEY`
- [ ] Endpoint que agenda bot via API quando reunião tá ~5min de começar
- [ ] Webhook `/api/webhooks/recall` recebe áudio + transcript quando termina
- [ ] Pipeline: bot termina → áudio em S3/Storage → trigger summarization

### Fase 5 — Realtime + observabilidade (1-2 dias)

**Objetivo**: dashboard atualiza ao vivo enquanto reuniões processam, alerta em falhas.

- [ ] `useRealtimeRefresh` na lista pra mostrar status mudando ao vivo
- [ ] Sentry breadcrumbs em cada step do processamento
- [ ] Notificações push quando reunião terminar de processar

## Custos estimados mensais (50 reuniões de 1h)

| Item | Sem bot | Com Recall.ai |
|---|---|---|
| Recall.ai | — | ~$45 |
| Whisper transcription | ~$18 | $0 (incluso) |
| Claude (resumo + insights + tasks) | ~$3 | ~$3 |
| Supabase Storage | ~$0.10 | ~$0.10 |
| **Total** | **~$21/mês** | **~$48/mês** |

## Estrutura de pastas

```
src/
  app/(authed)/reunioes/
    page.tsx                  # Lista
    [id]/page.tsx             # Detalhe
    conectar/page.tsx         # OAuth flow
    metricas/page.tsx         # Dashboard
  components/reunioes/
    MeetingCard.tsx
    MeetingStatusBadge.tsx
    ParticipantAvatar.tsx
    ConnectGoogleBanner.tsx
    RecordingPlayer.tsx
    TranscriptViewer.tsx
    SummaryPanel.tsx
    TopicsTimeline.tsx
    InsightsPanel.tsx
    ExtractedTasksPanel.tsx
    MeetingDetailTabs.tsx     # client (tabs)
  lib/reunioes/
    tipos.ts
    queries.ts
    mock-data.ts              # remover na Fase 1
    google/
      oauth.ts                # STUB
      calendar.ts             # STUB
    transcription/
      whisper.ts              # STUB
    ai/
      summarizer.ts           # STUB
supabase/migrations/
  20260513000000_reunioes_fase1.sql
```

## Variáveis .env necessárias

```bash
# Fase 1
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=https://sistemaacompanha.yidedigital.com.br/api/auth/google-callback

# Fase 2
OPENAI_API_KEY=sk-...

# Fase 3 (já existe na stack)
ANTHROPIC_API_KEY=sk-ant-...

# Fase 4 (opcional)
RECALL_API_KEY=
RECALL_WEBHOOK_SECRET=
```
