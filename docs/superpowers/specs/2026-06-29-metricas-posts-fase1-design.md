# Métricas dos Posts — Fase 1 (coleta + selinho)

**Data:** 2026-06-29
**Módulo:** Social Media (`/social-media`)
**Status:** Aprovado para implementação

## Objetivo

Puxar as métricas dos posts já publicados (Instagram + Facebook) do Meta, guardar no banco,
e mostrar um **selinho de métricas em cada post** na lista. É a base que depois alimenta o
painel de resumo (Fase 2) e o "melhor horário".

## Decisões de produto (brainstorm)

1. **Métricas (completo):** alcance, curtidas, comentários, salvamentos, compartilhamentos, engajamento total.
2. **Exibição:** selinho por post (Fase 1) + painel de resumo (Fase 2, fora desta entrega).
3. **Visibilidade:** interno (equipe Yide). Portal do cliente fica pra depois.
4. **Atualização:** cron **3x ao dia** + botão "Atualizar métricas" (sob demanda). Sem custo relevante.

## Pré-requisito de setup (responsável: Yasmin)

A chave (System User Token) precisa ganhar a permissão **`instagram_manage_insights`** e ser
**gerada de novo** (Business Settings → Usuários do sistema → yidesistema → Gerar token, marcando
também `read_insights`/`instagram_manage_insights`; atualizar `META_SYSTEM_USER_TOKEN` no Vercel).
Sem isso, a coleta retorna vazio e a UI mostra "—" (não quebra nada).

## O que já existe pra reaproveitar

- `metaFetch` + `META_SYSTEM_USER_TOKEN` + `META_GRAPH_API_VERSION` em `src/lib/social-media/meta-publish.ts`.
- IDs guardados no publish: `social_media_posts.instagram_post_id`, `.facebook_post_id`, `.publicado_em`.
- Padrão de cron com `CRON_SECRET` (`src/app/api/cron/social-media-publish/route.ts`).
- Padrão de upsert idempotente e service-role do Tráfego (`src/lib/trafego/meta-sync.ts`).
- Lista de posts: `src/components/social-media/PostsListView.tsx` (onde entra o selinho).

## Arquitetura

### 1. Banco (migration manual)

Tabela nova `social_media_metricas` — **snapshot do valor mais recente** por (post, rede, métrica):

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `post_id` | uuid FK → social_media_posts(id) on delete cascade | |
| `rede` | text | 'instagram' \| 'facebook' |
| `metrica` | text | 'alcance' \| 'curtidas' \| 'comentarios' \| 'salvamentos' \| 'compartilhamentos' \| 'engajamento' |
| `valor` | bigint | número da métrica |
| `coletado_em` | timestamptz | quando foi puxado |

- **Unique** `(post_id, rede, metrica)` → upsert atualiza valor + coletado_em (sempre o mais recente, sem histórico — suficiente pra Fase 1 e pro "melhor horário", que usa `publicado_em` + engajamento).
- Índice em `post_id`.
- RLS seguindo o padrão das outras tabelas social_media (acesso via organização; leitura pela app, escrita via service-role no cron). Detalhe exato no plano.

### 2. Coleta (Graph API)

Novo `src/lib/social-media/meta-insights.ts` (server-only), reusando `metaFetch`:

- `getInstagramMediaInsights(mediaId)`: `GET /{media-id}/insights?metric=reach,likes,comments,saved,shares,total_interactions`. Mapeia → { alcance, curtidas, comentarios, salvamentos, compartilhamentos, engajamento }. Tolera métricas ausentes (depende do tipo de mídia) sem falhar.
- `getFacebookPostInsights(postId)`: alcance via `post_impressions_unique`; reações/comentários/compartilhamentos via fields do post (`/{post-id}?fields=reactions.summary(true),comments.summary(true),shares`). Mapeia → mesmas chaves (salvamentos não existe no FB → omitido).
- Cada função retorna `{ metricas: Partial<Record<Metrica, number>> } | { error }`. Nunca lança.

### 3. Sync + cron + ação manual

- `src/lib/social-media/insights-sync.ts`: `sincronizarMetricasPost(postId)` e `sincronizarMetricasPendentes(limit)`:
  - Seleciona posts `status='publicado'`, `archived_at IS NULL`, publicados nos últimos ~30 dias, com `instagram_post_id` e/ou `facebook_post_id`.
  - Pra cada um, chama as funções de insights e faz **upsert** na `social_media_metricas`.
- Cron `src/app/api/cron/social-media-insights-sync/route.ts` (GET, auth `CRON_SECRET`) → chama `sincronizarMetricasPendentes`. Limite de segurança por execução (ex: 50 posts).
- `vercel.json`: adicionar cron `{ "path": "/api/cron/social-media-insights-sync", "schedule": "0 11,17,23 * * *" }` (3x/dia UTC ≈ 7h/13h/19h BRT).
- Ação manual `atualizarMetricasPostAction(postId)` (server action, permissão `canManage`) → `sincronizarMetricasPost` → revalida. Liga no botão "Atualizar métricas".

### 4. UI — selinho no post

- `queries.ts`: incluir as métricas agregadas por post na query da lista (ou um fetch leve por post publicado). Shape: `metricas?: { alcance, curtidas, comentarios, salvamentos, compartilhamentos, engajamento } | null`.
- `PostsListView.tsx`: pra posts `publicado`, mostrar o selinho `👁 {alcance} · ❤️ {curtidas} · 💬 {comentarios} · 🔖 {salvamentos} · 🔁 {compartilhamentos}` (compacto, com fallback "—" quando não houver dado). Botão pequeno **"Atualizar métricas"** que chama `atualizarMetricasPostAction`.
- Formatação de número compacta (1.2K) — helper simples.

## Tratamento de erros / casos de borda

- **Token sem `instagram_manage_insights`** → insights retorna erro do Meta → guardamos nada, UI mostra "—". Sem quebrar.
- **Post sem `instagram_post_id`/`facebook_post_id`** (não publicado ou story) → pula. Story não tem insights de feed.
- **Métrica indisponível pro tipo de mídia** → omite aquela métrica, grava as que vieram.
- **Rate limit do Meta** → erro tratado, tenta de novo na próxima rodada do cron.
- **Coluna/tabela ausente em prod (migration ainda não rodada)** → fallback: a UI trata métricas ausentes como "—"; o cron loga e segue.

## Testes

- Unit test de `meta-insights.ts` (mock `metaFetch`): mapeia resposta do IG corretamente; tolera métrica ausente; retorna `{error}` quando o Meta erra. (FB idem, simplificado.)
- Unit test do mapeamento de números compactos (1234 → "1.2K").

## Fora de escopo (Fase 2+)

- Painel de resumo por cliente (totais do mês, top posts).
- "Melhor horário pra postar".
- Exibição no Portal do Cliente.
- Histórico diário de métricas (guardamos só o snapshot mais recente).

## Banco de dados

- **1 migration** (`social_media_metricas`). **Aplicação manual** no Supabase após o merge (Vercel não roda migration no deploy). O SQL será entregue no PR.
