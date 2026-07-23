# Reuniões do cliente — gravação + transcrição + IA (design)

Data: 2026-07-22
Autora do pedido: Yasmin
Status: aprovado para virar plano de implementação

## Objetivo

Toda reunião com cliente — **online (Meet/Zoom) ou presencial** — deve poder ser
**gravada, guardada no sistema e transcrita automaticamente**. A partir da
transcrição, a IA gera **resumo**, **tarefas sugeridas** e **insights comerciais**.

Reaproveita o módulo **Reuniões** já existente (hoje uma casca "Fase 0" com UI
premium + schema SQL pronto + stubs, tudo em mock). Este design tira do mock e
liga na prática, estendendo o escopo de "prospecção do Comercial" para
"reuniões com cliente" em geral.

## Decisões (do brainstorm)

1. **Captura:** botão **"Gravar reunião"** no app (grava pelo navegador/celular).
   Serve presencial (microfone) e online (microfone + opção de capturar o áudio
   da aba do Meet). NÃO é bot auto-join — alguém aperta "Gravar". (Recall.ai
   auto-join fica como fase futura paga, fora deste escopo.)
2. **Saídas automáticas:** gravação + transcrição + **resumo** + **tarefas
   sugeridas** + **insights comerciais**.
3. **Quem vê:** quem gravou (owner) + gestão (sócios/adm/coordenadores). Assessor
   NÃO vê reunião de cliente de outro assessor.
4. **Quem grava:** assessor, coordenador, comercial, sócio, adm.
5. **Transcrição:** Whisper (OpenAI) — mais barato/bom em PT-BR. Diarização
   ("quem falou") inferida pela IA quando útil; não é requisito do MVP.
6. **Storage do áudio:** bucket privado no Supabase Storage.
7. **LGPD:** aviso "Esta reunião está sendo gravada" + consentimento antes de
   iniciar; política de retenção herda a migration de retenção existente.

## O que o usuário vê / fluxo

### Iniciar
- Entra no cliente (aba "Reuniões") ou na lista central `/reunioes` → botão
  **"Gravar reunião"**.
- Modal: escolhe **cliente** (pré-preenchido se veio do cadastro do cliente),
  título opcional, e um checkbox de consentimento LGPD ("os participantes foram
  avisados que a reunião será gravada").
- Online: opção **"Capturar áudio da aba"** (usa `getDisplayMedia` — a pessoa
  escolhe a aba do Meet e marca 'compartilhar áudio'). Presencial: só microfone.

### Gravando
- Cria a `meetings` (source `app_recording`, status `in_progress`,
  `owner_user_id` = quem grava, `client_id`).
- Grava no navegador via `MediaRecorder` (áudio, formato comprimido — mono,
  bitrate baixo pra caber no limite do Whisper). Timer + botão "Parar".
- Faixa "🔴 Gravando" visível.

### Ao parar
- Sobe o arquivo pro bucket privado (upload direto do browser com URL assinada).
- Registra em `meeting_recordings`, marca `recording_ready`, status `processing`,
  e enfileira os jobs em `meeting_processing_jobs` (`transcription` →
  `summarization`/`insights`/`tasks_extraction`).

### Processamento (servidor, automático)
- **Transcrição:** baixa o áudio, chama Whisper → grava `meeting_transcripts`
  (texto + segmentos com timestamp), marca `transcript_ready`.
  - Se o arquivo passar de 25MB (limite Whisper), comprime/particiona em blocos
    e concatena os segmentos com offset de tempo.
- **IA (Claude):** a partir da transcrição gera, em paralelo:
  - `meeting_summaries` (resumo, decisões, próximos passos, tópicos) → `summary_ready`
  - insights (objeção/sinal de compra/risco/oportunidade/dúvida/decisão, com
    trecho + minuto) → `insights_ready`
  - `meeting_extracted_tasks` (tarefas candidatas com título/descrição/sugestão
    de responsável/prazo, estado `sugerida`)
- Status vira `completed`. Falha em qualquer etapa → `failed` + `last_error` no job.

### Ver a reunião (`/reunioes/[id]` — UI já existe)
- Player do áudio + tabs Resumo / Tópicos / Transcrição / Insights / Tarefas.
- Botões "Aceitar tarefa" (insere em `tasks`) / "Descartar".

## Arquitetura / orquestração

- **Frontend:** componente cliente de gravação (`MediaRecorder`), reusa os
  componentes existentes de `components/reunioes/*`.
- **Upload:** URL assinada do Supabase Storage; o browser sobe direto pro bucket.
- **Processamento:** roda no servidor após o upload. Como transcrição+IA podem
  passar do tempo de uma request, usa a fila `meeting_processing_jobs`:
  - Um endpoint dispara o processamento logo após o upload (best-effort), e
  - Um **cron** de alguns minutos varre jobs `pending`/`failed`-retriável e
    processa (robustez se a request estourar o tempo). Padrão de fila já previsto
    no schema.
- **Libs a implementar** (hoje stub):
  - `src/lib/reunioes/transcription/whisper.ts` → chamada real ao Whisper.
  - `src/lib/reunioes/ai/summarizer.ts` → prompts Claude (resumo/insights/tasks).
  - `src/lib/reunioes/queries.ts` → trocar mock por SELECT real (Supabase
    service-role), aplicando a regra de visibilidade.
  - Novas server actions: criar reunião, assinar upload, registrar gravação,
    enfileirar/rodar processamento, aceitar/descartar tarefa.

## Modelo de dados

Reusa as tabelas da migration existente `20260513000000_reunioes_fase1.sql`
(`meetings`, `meeting_participants`, `meeting_recordings`, `meeting_transcripts`,
`meeting_summaries`, `meeting_extracted_tasks`, `meeting_processing_jobs`).

Ajustes necessários (nova migration manual):
- Adicionar valor `app_recording` ao enum `meeting_source` (grava pelo app).
- Criar **bucket privado** de Storage pra áudios (ex.: `meeting-recordings`) +
  policies.
- (Opcional) refinar RLS de `meetings`/filhas pra visibilidade "owner + gestão";
  como o app lê via service-role e filtra em código, a regra de visibilidade
  também é aplicada na camada de query. Manter as duas alinhadas.

## Controle de acesso

- **Gravar/criar:** roles `assessor, coordenador, comercial, socio, adm`.
- **Ver:** `owner_user_id == user` OU role de gestão (`socio, adm, coordenador`).
  - "Cliente do assessor": owner é quem gravou; assessor vê as próprias. Gestão
    vê todas. (Fonte única numa função `podeVerReuniao(user, meeting)` em
    `permissions`/lib de reuniões.)
- Enforced na camada de query (service-role) e espelhado na RLS quando refinada.

## LGPD / consentimento

- Checkbox de consentimento obrigatório antes de iniciar.
- Faixa "gravando" visível durante a captura.
- Retenção: usa a migration `20260515000000_reunioes_retencao.sql` já existente.

## Setup / .env (fora do código)

- `OPENAI_API_KEY` — Whisper (nova conta/chave OpenAI + billing).
- Aplicar migrations manuais: a `20260513000000_reunioes_fase1.sql` (base, ainda
  não aplicada), a de retenção, e a nova (enum `app_recording` + bucket).
- `npm run db:types` após aplicar, pra regenerar `src/types/database.ts`.

## Custos estimados (~50 reuniões de 1h/mês)

- Whisper: ~US$18 · Claude (resumo+insights+tasks): ~US$3 · Supabase Storage:
  ~US$0,10 → **~US$21/mês**. (Recall.ai auto-join, se um dia, +~US$27.)

## Fora de escopo (fases futuras)

- Bot auto-join online (Recall.ai) — 100% sem apertar "gravar".
- Google Calendar sync / OAuth (Fase 1 do roadmap antigo).
- Diarização nativa por provider (AssemblyAI/Deepgram).
- Detecção de speaker por vídeo.

## Plano de entrega (fatias)

1. **Gravar + guardar:** botão, `MediaRecorder`, upload pro bucket, cria
   `meetings`+`meeting_recordings`, aba no cliente, lista real (sem mock).
   Já entrega "gravada e guardada no sistema".
2. **Transcrever:** Whisper + `meeting_transcripts` + fila/cron. Entrega
   "transcrita automaticamente".
3. **IA:** resumo + insights + tarefas sugeridas (aceitar/descartar → `tasks`).
4. **Acabamento:** visibilidade fina, LGPD, realtime de status, retenção.
