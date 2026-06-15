# Escritório Virtual — Excluir DM/Canal + Realtime confiável — Design

**Data:** 2026-06-15
**Status:** Aprovado (brainstorming), aguardando plano de implementação

## Objetivo

Melhorar o Escritório Virtual (chat interno) com:
1. **Excluir conversa de DM** (1-a-1) — apaga pra todos os dois participantes (irreversível).
2. **Excluir canal fixo** (Geral, Comercial, etc.) — só sócio, recuperável (soft delete + restaurar).
3. **Realtime confiável** — corrigir o bug onde mensagens recebidas "nunca aparecem sem recarregar".

Sugestão de entrega: **2 PRs independentes** — (A) excluir DM/canal; (B) realtime.

## Contexto atual (mapa do código)

- **Tabelas** (`supabase/migrations/20260508000054_escritorio_virtual.sql` + `..._canais_extras_*` + `20260508140000_add_channel_kind_direct.sql` + `20260508140100_chat_dm_member_ids.sql`):
  - `chat_channels (id, kind chat_channel_kind, nome, descricao, ordem, member_ids uuid[], created_at)`.
    - 7 canais fixos por papel (`kind` enum único: geral, comercial, administrativo, assessores_coordenadores, coordenadores_estrategico, audiovisual_geral, designers).
    - DMs: `kind='direct'`, `member_ids=[A,B]` (sempre 2). Unique index parcial garante 1 DM por par.
  - `chat_messages (... channel_id, autor_id, conteudo, ...)` — `on delete cascade` no `channel_id`.
  - `chat_reads (user_id, channel_id, last_read_at)` — `on delete cascade` no `channel_id`.
  - RLS: `chat_channels` só tem SELECT (`using true`). Escritas de canal (criar DM) usam **service-role** + checagem no código (ver `dm-actions.ts`). `chat_messages` tem RLS por membership via `can_access_chat_channel`.
- **Server:**
  - `src/lib/escritorio/queries.ts` — `listAccessibleChannels`, `getChannelByKind`, `listMessages`, `listChannelsWithUnread`, `countChannelsWithUnread`, e (a confirmar no plano) a listagem de DMs. Cache 15s com tag `ESCRITORIO_UNREAD_TAG`.
  - `src/lib/escritorio/actions.ts` — `sendChatMessageAction`, `markChannelReadAction`.
  - `src/lib/escritorio/dm-actions.ts` — `openOrCreateDmAction(targetUserId)` (service-role, idempotente).
  - `src/lib/escritorio/icon-actions.ts` — (ícones de canal).
- **Client:**
  - `src/app/(authed)/escritorio/[kind]/page.tsx` — server component; `listMessages` + `ChannelView`.
  - `src/components/escritorio/ChannelSidebar.tsx` — lista canais + DMs (botões de excluir entram aqui).
  - `src/components/escritorio/ChannelView.tsx` — usa `useRealtimeMessages`.
  - `src/lib/escritorio/use-realtime-messages.ts` — realtime + **polling fallback 5s** + refetch on visibility.
  - `src/lib/supabase/realtime-auth.ts` — `authenticateRealtime` (seta JWT no websocket).
  - `src/lib/supabase/client.ts` — `createBrowserClient` (@supabase/ssr, cookie-based).

## Decisões (do brainstorming)

1. **DM:** excluir apaga **pra todo mundo** (irreversível). Pode excluir: qualquer um dos 2 participantes (ou sócio/adm).
2. **Canal fixo:** excluir é **só sócio**, **recuperável** (soft delete + restaurar).
3. **Realtime:** é bug. O código já tem realtime + polling 5s; o conserto é de robustez/observabilidade.

---

## Parte A — Excluir DM (hard delete, pra todos)

### Action
`deleteDmAction(channelId: string)` em `src/lib/escritorio/dm-actions.ts` (service-role, seguindo o padrão do `openOrCreateDmAction`):
1. `requireAuth()`.
2. Busca o canal: `select id, kind, member_ids`. Se não existe → erro "Conversa não encontrada".
3. Valida: `kind === 'direct'` **E** (`actor.id ∈ member_ids` **OU** `actor.role ∈ ('socio','adm')`). Senão → "Sem permissão".
4. `delete from chat_channels where id = channelId` (cascade apaga `chat_messages` + `chat_reads`).
5. `revalidateTag(ESCRITORIO_UNREAD_TAG, "default")`.
6. Retorna `{ success: true }`.

### UI (`ChannelSidebar.tsx`)
- Em cada linha de DM, um menu "⋯" (ou ícone de lixeira no hover) → item "Excluir conversa".
- Confirmação (`confirm(...)` ou dialog): "Apagar a conversa com {nome} pra vocês dois? Não dá pra desfazer."
- Ao confirmar: chama `deleteDmAction`, remove o DM da lista. Se o DM aberto era o excluído, redireciona pra `/escritorio` (ou primeiro canal).
- O botão de excluir DM aparece pra **participante ou sócio/adm**.

### Notas
- A outra pessoa, se estiver com o DM aberto, vê o canal sumir só ao navegar/recarregar (lista lateral não é realtime hoje — fora de escopo). Aceitável.

---

## Parte B — Excluir canal fixo (soft delete, só sócio, recuperável)

### Migration (`supabase/migrations/20260615000001_escritorio_canal_soft_delete.sql`)
```sql
alter table public.chat_channels
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id);

create index if not exists idx_chat_channels_deleted_at
  on public.chat_channels (deleted_at) where deleted_at is not null;
```
Apply **manual** (SQL Editor). Aditivo/retrocompatível.

### Queries (`src/lib/escritorio/queries.ts`)
- **Toda** listagem/contagem de canal passa a filtrar `deleted_at is null`:
  - `listAccessibleChannels`, `listChannelsWithUnread`, `getChannelByKind`, e a listagem de DMs.
- Fallback pré-migration (memória `feedback_calendar_fullselect_fallback`): como o filtro é `.is("deleted_at", null)` numa coluna que pode não existir ainda, envolver com try/retry sem o filtro (ou só aplicar o filtro se a coluna existir). O plano define o mecanismo (re-tenta sem `deleted_at` se o erro mencionar `deleted_at`/`schema cache`).
- `getChannelByKind`: se o canal estiver soft-deleted, tratar como inexistente (page → `notFound()`), salvo quando o sócio está restaurando.

### Actions (novo `src/lib/escritorio/channel-actions.ts`)
- `deleteChannelAction(channelId)` — service-role:
  1. `requireAuth()`; se `actor.role !== 'socio'` → "Apenas sócio pode excluir canais".
  2. Busca canal; se `kind === 'direct'` → "Use excluir conversa" (DMs não passam por aqui).
  3. `update chat_channels set deleted_at=now(), deleted_by=actor.id where id=channelId and deleted_at is null`.
  4. `revalidateTag(ESCRITORIO_UNREAD_TAG)`; revalidar `/escritorio`.
- `restoreChannelAction(channelId)` — service-role; só sócio; `update ... set deleted_at=null, deleted_by=null where id=channelId`.

### UI (`ChannelSidebar.tsx`)
- Em cada canal fixo, **só pro sócio**, um menu "⋯" → "Excluir canal" (confirm: "Excluir o canal {nome}? Dá pra restaurar depois.").
- Seção **"Canais excluídos"** no rodapé da lista lateral, **só pro sócio**: lista os canais com `deleted_at != null` (nova query `listDeletedChannels()` service-role, só sócio) com botão **Restaurar** por item.
- Se o sócio estiver vendo um canal e o excluir, redireciona pra `/escritorio`.

---

## Parte C — Realtime confiável

Arquivo: `src/lib/escritorio/use-realtime-messages.ts`. O hook já tem realtime + polling 5s + refetch on visibility. Mudanças de robustez:

1. **Polling independente do realtime auth.** Hoje `start()` faz `await authenticateRealtime()` ANTES de `setInterval(pollNew)`. Se o await rejeita/trava, o polling nunca começa → "nunca atualiza". Reordenar: iniciar o `setInterval(pollNew, 5000)` + o listener de `visibilitychange` **antes/independente** do `await authenticateRealtime()` (ou em `try/catch` que não impeça o polling). Um poll imediato no mount também.
2. **Reconexão.** Passar callback de status ao `.subscribe((status) => …)`: em `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED`, re-subscrever (com backoff simples) e disparar um `pollNew()` pra cobrir o gap.
3. **Observabilidade.** `console.warn` no status de erro da subscription e no catch do `pollNew` (hoje silencioso). Se o bug persistir, esses logs no console da Julia apontam a causa real (RLS, websocket, auth).
4. (Confirmar no plano) Garantir que `pollNew` trata erro do `select` (catch) e não morre silenciosamente.

> Se depois desse hardening ainda falhar pra Julia, próximo passo é coletar o erro do console do navegador dela (Phase 1 evidence) — fora deste escopo de código, mas registrado.

### Verificação de ambiente (não é código)
- Confirmar que `alter publication supabase_realtime add table public.chat_messages` foi aplicado em produção (migração manual). Se não, realtime não emite — mas o polling (item 1) já cobre a UX de qualquer forma.

---

## Testes

- **deleteDmAction:** participante apaga (sucesso, canal/mensagens somem); não-participante não-sócio → "Sem permissão"; sócio apaga DM de terceiros (sucesso); rejeita `kind != 'direct'`.
- **deleteChannelAction / restoreChannelAction:** não-sócio → erro; sócio soft-deleta canal fixo; rejeita DM; restore reativa.
- **queries:** canal soft-deleted some de `listAccessibleChannels`/`listChannelsWithUnread`/`getChannelByKind`; `listDeletedChannels` só retorna pro sócio.
- **use-realtime-messages:** difícil testar em unit (Next/websocket). Cobrir a lógica pura extraível se houver (ex.: dedupe/append); o resto é verificação manual.

## Notas de deploy

- Migration **manual** (`20260615000001_...`) — aditiva. Aplicar idealmente antes do merge do PR-A; fallback no código cobre a janela.
- Bump de cache keys se o shape de alguma query cacheada mudar (memória `feedback_cache_shape_changes`).
- `chat_channels` escreve via **service-role** + checagem no código (padrão do módulo); sem RLS nova necessária. As ações de delete validam permissão no servidor.
- Regenerar tipos (`chat_channels.deleted_at/deleted_by`) em `src/types/database.ts`.
- Branch a partir de `origin/main`.

## Fora de escopo (YAGNI)

- Lista lateral (canais/DMs) em realtime — excluir reflete só ao navegar/recarregar pro outro usuário.
- Excluir/editar **mensagem** individual (a RLS já permite delete da própria/admin, mas sem UI — não pedido agora).
- Grupos custom com N pessoas (DMs são estritamente 1-a-1 hoje).
- `/lixeira` global pra canais — o restore fica numa seção própria do Escritório.
