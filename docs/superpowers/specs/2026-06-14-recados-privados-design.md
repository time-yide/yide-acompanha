# Recados privados (direcionados) — Design

**Data:** 2026-06-14
**Status:** Aprovado (brainstorming), aguardando plano de implementação

## Objetivo

Permitir deixar um recado **privado** direcionado a uma ou mais pessoas específicas
(ex.: deixar recado pra 1 pessoa isoladamente). Os **sócios** têm visão de auditoria:
veem todos os recados privados trocados na equipe (quem mandou pra quem, conteúdo).
Recipientes continuam recebendo **notificação + bolinha**; sócios **não** recebem
notificação/bolinha por recado privado de terceiros (só a visão de auditoria ao abrir Recados).

## Contexto atual (o que já existe)

- Tabela `recados`: modelo **broadcast**. RLS de SELECT é `using (true)` — todo mundo lê tudo.
  `notif_scope` (`todos`/`meu_time`/`nenhum`) controla apenas **quem é notificado**, não quem lê.
- `recado_visualizacoes (user_id, last_seen_at)`: 1 marcador global por usuário; a bolinha
  conta recados não arquivados, não permanentes, criados depois do `last_seen_at` por outros.
- `recado_reacoes`: reações emoji.
- Queries (`src/lib/recados/queries.ts`) usam **service-role** (`createServiceRoleClient`) dentro
  de `unstable_cache` → **furam RLS**. A barreira de visibilidade real é o código da query.
- `listRecados(arquivado)` retorna todos; `countRecadosNaoLidos(userId)` alimenta a bolinha,
  chamada em toda página autenticada via `(authed)/layout.tsx`.
- Página `(authed)/recados/page.tsx`: abas `Ativos | Arquivados`. Ao abrir `ativos`, faz upsert
  de `last_seen_at = now()`.
- `NovoRecadoDialog`, `RecadoFeed` (agrupa por tier sócios/coordenadores/assessores/geral via
  `groupByTier`), `RecadoCard`.
- `criarRecadoAction` (cookie client) insere o recado e dispara `dispatchNotification`
  (`evento_tipo: "recado_novo"`) pros `recipientIds` resolvidos por `resolveRecipientIds`.
- `isPrivileged(user)` = `socio` **ou** `adm` — usado em editar/apagar/arquivar.

## Decisões (do brainstorming)

1. Visibilidade do conteúdo de um privado: **autor + destinatários + sócio**.
2. Privados aparecem numa **aba separada** "Privados" (não misturados no mural), mas continuam
   gerando **notificação + bolinha** pro destinatário.
3. Envio: **1 ou mais** destinatários (multi-seleção).
4. Sócio: **só visão de auditoria**, **sem** notificação/bolinha de privados de terceiros.
5. Auditoria dos privados é **só `socio`** (não `adm`). `adm` mantém os poderes atuais no mural.

## Modelo de dados

Migration nova (apply **manual** via SQL Editor após merge — Vercel não roda migrations).

### `recados` — coluna nova
```sql
alter table public.recados
  add column privado boolean not null default false;

create index idx_recados_privado on public.recados (privado, arquivado, criado_em desc);
```

### `recado_destinatarios` — tabela nova
```sql
create table public.recado_destinatarios (
  recado_id uuid not null references public.recados(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  lido_em   timestamptz null,
  criado_em timestamptz not null default now(),
  primary key (recado_id, user_id)
);

create index idx_recado_dest_user on public.recado_destinatarios (user_id, lido_em);
create index idx_recado_dest_recado on public.recado_destinatarios (recado_id);
```

`lido_em` por destinatário é o marcador de leitura **individual** dos privados — não dá pra
reusar o `last_seen_at` global do mural (abrir o mural "limparia" privados não lidos).

## Visibilidade / RLS

### RLS (defesa em profundidade — vale pro cookie client)

`recados` — substituir a policy de SELECT `using (true)` por:
```sql
drop policy "recados select all authenticated" on public.recados;

create policy "recados select visible"
  on public.recados for select to authenticated
  using (
    privado = false
    or autor_id = auth.uid()
    or public.current_user_role() = 'socio'
    or exists (
      select 1 from public.recado_destinatarios d
      where d.recado_id = recados.id and d.user_id = auth.uid()
    )
  );
```
(insert/update/delete policies de `recados` permanecem como estão.)

`recado_destinatarios`:
```sql
alter table public.recado_destinatarios enable row level security;

create policy "recado_dest select visible"
  on public.recado_destinatarios for select to authenticated
  using (
    user_id = auth.uid()
    or public.current_user_role() = 'socio'
    or exists (select 1 from public.recados r
               where r.id = recado_id and r.autor_id = auth.uid())
  );

create policy "recado_dest insert by author"
  on public.recado_destinatarios for insert to authenticated
  with check (
    exists (select 1 from public.recados r
            where r.id = recado_id and r.autor_id = auth.uid())
  );

-- destinatário marca a própria leitura
create policy "recado_dest update own lido"
  on public.recado_destinatarios for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "recado_dest delete by author"
  on public.recado_destinatarios for delete to authenticated
  using (exists (select 1 from public.recados r
                 where r.id = recado_id and r.autor_id = auth.uid()));
```

### App (barreira real — service-role fura RLS)

As queries de leitura usam service-role; a visibilidade é garantida **no código**:
- **Mural**: filtra `privado = false`.
- **Privados (usuário comum)**: recados `privado = true` onde sou autor **ou** estou em
  `recado_destinatarios`.
- **Privados (sócio)**: todos os `privado = true` (visão de auditoria), além dos seus próprios.

## Queries (`src/lib/recados/queries.ts`)

- `listRecados(arquivado)` → passa a filtrar **`privado = false`** (mural só). Bump da cache key.
- **Nova** `listPrivados(userId, role, arquivado)`:
  - service-role; seleciona privados + join `recado_destinatarios` (com `nome`/`avatar` de cada
    destinatário pra renderizar "para: X") + reações.
  - se `role === 'socio'`: retorna todos os privados.
  - senão: filtra em app por `autor_id = userId` **ou** userId ∈ destinatários.
  - retorna também, por recado, a marca de leitura do usuário atual (`lido_em`) e o autor.
  - **não** cacheia com `unstable_cache` por usuário de forma global ingênua; chave inclui
    `userId`+`role`+`arquivado`, tag `recados`. (Seguir padrão de `countRecadosNaoLidos`.)
- `countRecadosNaoLidos(userId)` → passa a somar:
  1. **mural não lido**: lógica atual, restrita a `privado = false`.
  2. **privados não lidos pra mim**: count em `recado_destinatarios` com `user_id = userId`,
     `lido_em is null`, recado não arquivado, autor ≠ userId.
  - Total = (1) + (2). Bump da cache key.
- **Fallback do SELECT**: qualquer coluna nova no fullSelect precisa estar coberta no fallback/catch
  (memória `feedback_calendar_fullselect_fallback`) — incluir `privado` e o join de destinatários.

## Actions (`src/lib/recados/actions.ts`)

- `criarRecadoAction`:
  - aceita `privado` (bool) + `destinatarios` (lista de uuids) via FormData.
  - validação (zod): se `privado === true`, `destinatarios` deve ter **≥ 1** id; cada id é uuid de
    perfil ativo. Se `privado`, ignora/zera `notif_scope` e `permanente` (privado não fixa).
  - insere `recados` com `privado = true` (cookie client → RLS aplica), depois insere as linhas em
    `recado_destinatarios`.
  - **RLS silencioso em insert/update** (memória `feedback_supabase_rls_silent_update`): após o
    insert das linhas de destinatário, conferir `.select()` + length pra detectar 0 rows.
  - dispara `recado_novo` **só pros destinatários** (`user_ids_extras = destinatarios`,
    `source_user_id = autor`). Não notifica sócio.
- **Nova** `marcarPrivadosLidosAction()`:
  - cookie client; `update recado_destinatarios set lido_em = now() where user_id = auth.uid() and lido_em is null`.
  - `revalidatePath("/", "layout")` pra atualizar a bolinha.
- `editarRecadoAction` / `apagarRecadoAction` / `arquivarRecadoAction`: continuam usando
  `isPrivileged` (autor ou socio/adm) — sem mudança de regra; `on delete cascade` limpa
  `recado_destinatarios`.

## UI

### Abas em `/recados`
`Mural | Privados | Arquivados` (hoje: `Ativos | Arquivados`).
- **Mural**: `RecadoFeed` atual (tier groups), só `privado = false`.
- **Privados**: lista de privados do usuário (enviados + recebidos). Pro **sócio**, um bloco
  adicional "Todos os privados" (auditoria) separado dos próprios.
- **Arquivados**: como hoje.
- Ao abrir **Mural** → upsert `last_seen_at` (como hoje, mas a contagem do mural já é só `privado=false`).
- Ao abrir **Privados** → chama `marcarPrivadosLidosAction()`.

### Card de privado
Componente novo (ou variação do `RecadoCard`) que mostra **autor** + **"para: Fulana, Beltrano"**.
Sócio vê o card mesmo sem ser autor/destinatário (auditoria). Reações reaproveitadas.

### `NovoRecadoDialog`
- Toggle **"Recado privado"**.
- Ligado: aparece **seletor multi-pessoas** (perfis ativos); some o `notif_scope`; some "permanente".
- Desligado: comportamento atual (mural + notif_scope).

## Notificação + bolinha (resumo)

- Privado novo → notificação `recado_novo` **só pros destinatários**.
- Bolinha do item "Recados" = mural não lido (`privado=false`) + privados não lidos pra mim.
- Sócio: vê tudo na aba ao abrir, mas bolinha/notificação só dos privados endereçados a ele.

## Testes

- `recados-schema`: privado exige ≥1 destinatário; privado zera permanente; uuids válidos.
- visibilidade: usuário comum não vê privado de terceiros; destinatário vê; autor vê; sócio vê todos.
- contagem: bolinha soma mural (`privado=false`) + privados não lidos pra mim; não conta privado
  de terceiros (não-destinatário); não conta privado que eu mesmo enviei.
- `marcarPrivadosLidosAction` zera `lido_em is null` só do usuário atual.

## Notas de deploy

- Migration **manual** (SQL Editor) após merge do PR (memória `project_supabase_migrations_manual`).
- **Bump das cache keys** de `listRecados` e `countRecadosNaoLidos` no **mesmo PR** que muda o
  shape (memória `feedback_cache_shape_changes`).
- `unstable_cache` **só** com service-role; nunca cookie client dentro
  (memória `feedback_unstable_cache_service_role_only`).
- Branch a partir de `origin/main` (memória `feedback_branch_from_origin_main`).
- Regenerar `src/types/database.ts` após a migration (coluna `privado` + tabela nova).

## Fora de escopo (YAGNI)

- Exibir read-receipts ("Fulana leu às 14h") na UI — `lido_em` existe no banco, mas não
  renderizamos status de leitura nesta fase.
- Responder/threading dentro de um privado (é recado, não chat).
- Editar lista de destinatários depois de criado.
