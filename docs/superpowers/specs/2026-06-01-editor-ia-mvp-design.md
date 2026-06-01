# Editor de vídeo com IA (MVP) — design

**Data:** 2026-06-01
**Branch:** `feat/editor-ia` (base `origin/main`)

## Objetivo

Editor onde a usuária **sobe um vídeo** + escreve uma **instrução em texto** (ex.: "corta os silêncios e partes paradas, deixa dinâmico, põe legenda"), a **IA gera um plano de edição**, ela **revisa/corrige numa timeline simples**, e o sistema **renderiza** o MP4 final via **Shotstack** (nuvem, sem AWS). MVP focado em **cortar silêncios/partes paradas + legenda**.

## Decisões (alinhadas com a usuária)
- **Render:** Shotstack (API de edição na nuvem; sem AWS/servidor). Custo ~R$200–280/mês no volume estimado.
- **Edição:** descrição em texto → IA faz; + **ajuste manual** numa timeline.
- **Módulo novo** `/audiovisual/editor-ia`, **sem mexer no Yori atual** (que está parado no AWS). Plano de, no futuro, **aposentar o Yori antigo** e deixar só este (evitar dois editores).
- **MVP**: cortar silêncios/partes paradas + legenda (estilos prontos) + timeline pra ajustar cortes e texto.
- **Fase 2** (fora do MVP): subir **fonte própria, logo, música**, transições, cortes avançados.
- Vídeos **curtos** (Reels, até ~2-3 min) no MVP, pra controlar custo/tempo de render.

## Reaproveitamento do Yori (já existe na main)
- `src/lib/yori/services/groq-whisper.ts` → `transcribeAudio(...)` (transcrição com timestamps por palavra). **Reusar.**
- `src/lib/yori/srt-builder.ts` → `buildSrt`, `groupWordsIntoLines`, `buildTxt`. **Reusar.**
- `src/lib/yori/storage.ts` → upload/signed URL no Supabase Storage. **Reusar** (ou novo bucket).
- `src/lib/yori/services/claude-cleanup.ts` → limpeza do texto da legenda. **Reusar.**
- Padrão de jobs/feature-flag/queries/actions do Yori serve de molde.

## Arquitetura / componentes

### Rotas (`src/app/(authed)/audiovisual/editor-ia/`)
- `page.tsx` — lista de jobs + quota + botão "Novo".
- `novo/page.tsx` — upload do vídeo + campo de instrução.
- `[jobId]/page.tsx` — detalhe: status, **timeline de revisão** (quando `aguardando_revisao`), download (quando `pronto`).

### Lib (`src/lib/editor-ia/`)
- `feature-flag.ts` — `isEditorIaEnabled()` (checa `SHOTSTACK_API_KEY` + `GROQ_API_KEY`), `canUseEditorIa(role)` (mesmos papéis do Yori).
- `schema.ts` — Zod: criar job (instrução + metadados do vídeo), atualizar plano (segments/legenda), disparar render.
- `tipos.ts` — status do job, tipos do plano de edição (segmentos, legendas).
- `queries.ts` — listar/buscar jobs (service-role, scope por org).
- `actions.ts` — criar job, salvar revisão do plano, disparar render, webhook handler helper.
- `services/ia-plano.ts` — **planejador IA**: recebe `words[]` (transcrição) + `instrucao` → devolve **EditPlan** (lista de segmentos keep/cut com start/end + linhas de legenda). Implementação: detecta silêncios/gaps pela transcrição (lacunas > N s entre palavras) + LLM (Groq/Claude) interpreta a instrução pra decidir cortes/ênfase. Determinístico no fallback (se LLM falhar, corta só silêncios por heurística).
- `services/shotstack.ts` — **motor de render**: monta o JSON de edição do Shotstack a partir do `EditPlan` (clips com trim/concat + CaptionAsset), faz `POST /render`, e expõe checagem de status. Token via env. No-op tratável sem token.

### Dados (`supabase/migrations/2026XXXX_editor_ia.sql`)
- Tabela `editor_ia_jobs`:
  - `id, organization_id, user_id`
  - `status` (`enviando|transcrevendo|planejando|aguardando_revisao|renderizando|pronto|erro`)
  - `instrucao text`
  - `video_url text`, `video_duracao_segundos int`
  - `transcricao jsonb` (words)
  - `edit_plan jsonb` (segmentos + legendas; editável na timeline)
  - `shotstack_render_id text`, `output_url text`, `srt_url text`
  - `erro text`, `created_at, updated_at`
  - RLS `authenticated` (padrão do projeto) + trigger updated_at.
- Bucket Storage `editor-ia` (entrada/saída), privado.

### Fluxo
1. **Novo job**: upload do vídeo (Storage) + instrução → cria `editor_ia_jobs(status=transcrevendo)`.
2. **Transcrição**: `transcribeAudio` → grava `transcricao`, status `planejando`.
3. **Plano IA**: `ia-plano` gera `edit_plan` (segmentos keep/cut + legenda) → status `aguardando_revisao`.
4. **Revisão (timeline)**: usuária liga/desliga segmentos, ajusta cortes, edita texto/estilo da legenda → salva `edit_plan`.
5. **Render**: `shotstack.ts` monta o JSON do `edit_plan` → `POST /render` → guarda `shotstack_render_id`, status `renderizando`.
6. **Conclusão**: webhook do Shotstack (`/api/webhooks/editor-ia/shotstack`) OU polling → grava `output_url` (+ SRT), status `pronto`.
7. **Download**: MP4 + SRT.

## Env vars (a usuária pluga depois, no Vercel)
- `SHOTSTACK_API_KEY` (cadastro Shotstack)
- `GROQ_API_KEY` (já previsto pra Yori)
- (LLM de planejamento: usar Groq — mesma key — ou `ANTHROPIC_API_KEY` se preferir qualidade)
- Sem essas, `isEditorIaEnabled()` = false e o menu/rota ficam ocultos (não mostra link quebrado — lição do Yori).

## Testes
- Unit: `ia-plano` (heurística de silêncios: dado words com gaps, gera segmentos corretos; fallback sem LLM); `shotstack` (monta JSON de edição correto a partir de um EditPlan — clips/trim/caption); schema dos jobs/plano.
- Sem teste E2E de render real (depende de conta Shotstack — validação manual da usuária).

## Faseamento
- **MVP (este spec)**: upload → instrução → transcrição → plano IA (corta silêncios/partes paradas) → timeline (ligar/desligar trechos + editar legenda) → render Shotstack → download MP4+SRT. Estilos de legenda **prontos** (sem upload de fonte).
- **Fase 2**: subir fonte própria, logo, música, transições, cortes/efeitos avançados; aposentar o Yori antigo (redirect).

## Fora de escopo (YAGNI no MVP)
- Geração de vídeo por IA (não é o caso — é edição).
- Fonte própria/logo/música/transições (Fase 2).
- Render de vídeos longos (limite de duração no MVP).

## Riscos / atenção
- **Qualidade do plano da IA**: cortar "partes paradas" por transcrição+LLM tem limite; por isso a **timeline de revisão manual** é parte do MVP (a IA dá o rascunho, a usuária corrige).
- **Render assíncrono**: Shotstack é async; preferir **webhook** (com secret) + fallback de polling pra atualizar status sem travar request.
- **Custo por render**: limitar duração/tamanho no MVP; mostrar estimativa/quota.
- **Dependência externa paga**: sem `SHOTSTACK_API_KEY` o módulo fica desligado (igual Yori sem AWS) — e o menu deve ocultar o link quando desligado.
- **Migration manual** pós-merge (padrão do projeto).
- **Não desestabilizar o Yori**: módulo separado; não tocar em `src/lib/yori/*` além de reusar funções puras (transcrição/srt/storage/cleanup) via import.
