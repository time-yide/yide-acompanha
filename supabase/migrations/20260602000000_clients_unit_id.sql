-- Multi-tenant Fase 2: isola CLIENTS por unit_id.
--
-- Estratégia:
-- 1. Adiciona unit_id em clients, backfill TODOS pra Matriz, NOT NULL
-- 2. Index pra perf no filtro por unidade
-- 3. RLS de SELECT continua permissiva (`using true`) — o filtro é
--    feito no APP via getEffectiveUnitId. Razão: maior parte das queries
--    usa service-role (bypassa RLS) e mudar isso é refactor grande.
--    Para defesa-em-profundidade, adicionamos um policy MAIS restritivo
--    pra session-based queries de roles não-master, bloqueando leakage
--    cross-unit acidental.
-- 4. RLS de INSERT/UPDATE adiciona checagem de unit (não deixa cliente
--    de Salvador ser editado por assessor de Matriz, mesmo se URL é manipulada)

alter table public.clients
  add column unit_id uuid references public.units(id) on delete restrict;

-- Backfill: TODOS os clientes existentes vão pra Matriz
update public.clients
  set unit_id = (select id from public.units where slug = 'matriz' limit 1)
  where unit_id is null;

-- Já que back fill cobriu tudo, torna obrigatório
alter table public.clients alter column unit_id set not null;

create index idx_clients_unit_status on public.clients(unit_id, status)
  where deleted_at is null;

comment on column public.clients.unit_id is
  'Unidade a que o cliente pertence. Master users (adm/sócio) podem '
  'mudar via UI. Demais users só veem clientes da própria unidade.';

-- ─── RLS de SELECT — substitui a permissiva por uma sensível à unidade ────
-- O policy antigo "authenticated can view clients" usava `using (true)`.
-- Removemos e substituímos por uma versão que:
--   - Master (adm, socio): SEMPRE vê tudo (consolidado quando precisar)
--   - Demais: só vê clientes da própria unit_id
-- Service-role continua bypassando RLS (queries server-side ainda passam).

drop policy if exists "authenticated can view clients" on public.clients;

create policy "clients select by unit"
  on public.clients for select to authenticated
  using (
    public.is_unit_master()
    or unit_id = public.current_user_unit_id()
  );

-- ─── RLS de UPDATE — checagem extra de unit ───────────────────────────────
-- Policy existente "coord/assessor can update own clients" valida apenas
-- assessor_id/coordenador_id. Adicionamos uma checagem de unit_id pra
-- defesa em profundidade (assessor de Salvador não consegue editar cliente
-- de Matriz mesmo se fosse atribuído por erro).

drop policy if exists "coord/assessor can update own clients" on public.clients;

create policy "coord/assessor can update own clients"
  on public.clients for update to authenticated
  using (
    public.current_user_role() in ('coordenador', 'assessor')
    and unit_id = public.current_user_unit_id()
    and (assessor_id = auth.uid() or coordenador_id = auth.uid())
  )
  with check (
    public.current_user_role() in ('coordenador', 'assessor')
    and unit_id = public.current_user_unit_id()
    and (assessor_id = auth.uid() or coordenador_id = auth.uid())
  );

-- ─── INSERT: já era restrito a adm/socio. Sem mudança necessária ──────────
-- O app vai setar unit_id explicitamente baseado no cookie ativo.
