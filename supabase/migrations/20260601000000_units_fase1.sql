-- Multi-tenant Fase 1: tabela `units` + `profiles.unit_id`.
-- AINDA NÃO isola dados — só estrutura + seletor visual no TopBar.
-- Fase 2 vai adicionar unit_id em `clients` (e cascateia pelas tabelas
-- que referenciam cliente). Fase 3: financeiro/comissão. Fase 4:
-- dashboards consolidados.
--
-- Decisão produto:
-- - Cada cliente pertence a UMA unidade (não compartilhado)
-- - Apenas role 'adm' e 'socio' podem alternar entre unidades (master)
-- - Demais users ficam travados na própria unidade
-- - Unidade inicial: "Matriz" (Cuiabá), Salvador entra depois

-- ─── 1) Tabela units ────────────────────────────────────────────────────────
create table public.units (
  id uuid primary key default gen_random_uuid(),
  /** Nome exibido (ex: "Matriz", "Filial Salvador"). */
  nome text not null,
  /** Slug url-safe pro deeplink/cookie (ex: "matriz", "salvador"). */
  slug text not null,
  /** Inativa = não aparece no seletor mas dados antigos continuam acessíveis. */
  ativa boolean not null default true,
  /** Endereço da unidade (fase futura — dashboard). */
  endereco text,
  /** CNPJ separado por unidade (relevante quando virar franquia). */
  cnpj text,
  /** Cor de destaque pra ranking/badge (futuro). Ex: '#10b981' */
  cor_destaque text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index uq_units_slug on public.units(slug);
create index idx_units_ativa on public.units(ativa) where ativa;

create trigger trg_units_updated_at
  before update on public.units
  for each row execute function public.set_updated_at();

comment on table public.units is
  'Unidades/filiais da agência. Multi-tenant. Adm/sócio acessa todas, '
  'demais users só a própria unidade (via profiles.unit_id).';

-- ─── 2) Seed da unidade inicial ─────────────────────────────────────────────
insert into public.units (nome, slug, ativa) values ('Matriz', 'matriz', true);

-- ─── 3) profiles.unit_id ───────────────────────────────────────────────────
alter table public.profiles
  add column unit_id uuid references public.units(id) on delete restrict;

-- Backfill: todos os profiles existentes vão pra Matriz
update public.profiles
  set unit_id = (select id from public.units where slug = 'matriz' limit 1)
  where unit_id is null;

-- Após backfill, torna obrigatório
alter table public.profiles alter column unit_id set not null;

create index idx_profiles_unit on public.profiles(unit_id);

comment on column public.profiles.unit_id is
  'Unidade primária do colaborador. Adm/sócio podem operar como se '
  'fossem de qualquer unidade (master), mas o unit_id aqui é o "lar".';

-- ─── 4) RLS de units ────────────────────────────────────────────────────────
alter table public.units enable row level security;

-- SELECT: TODOS authenticated podem ler a lista de unidades (pra mostrar
-- nomes em telas — ex: badge "Matriz" em ficha de cliente futura).
-- Filtro de QUAIS unidades aparecem no seletor é feito no app (não RLS).
create policy "units select all authenticated"
  on public.units for select to authenticated
  using (true);

-- INSERT/UPDATE: só adm/sócio (gestão de unidades é decisão estratégica).
create policy "units insert socio"
  on public.units for insert to authenticated
  with check (public.current_user_role() in ('adm', 'socio'));

create policy "units update socio"
  on public.units for update to authenticated
  using (public.current_user_role() in ('adm', 'socio'))
  with check (public.current_user_role() in ('adm', 'socio'));

-- DELETE: nunca via app. Hard-delete só via SQL manual se realmente
-- precisar (e provavelmente quer mesmo é setar ativa=false).
-- Sem policy de delete.

-- ─── 5) Helper SQL: is_unit_master() ───────────────────────────────────────
-- Reutilizável em RLS futuro (Fase 2+) pra checar se o user atual é master.
create or replace function public.is_unit_master()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('adm', 'socio') from public.profiles where id = auth.uid()),
    false
  );
$$;

comment on function public.is_unit_master() is
  'Retorna TRUE se o usuário atual pode operar em qualquer unidade '
  '(adm ou sócio). Usado em RLS das Fases 2-4.';

-- ─── 6) Helper SQL: current_user_unit_id() ─────────────────────────────────
-- Retorna o unit_id "lar" do user atual. Master users podem operar em
-- outras unidades, mas esse helper sempre retorna o de origem.
create or replace function public.current_user_unit_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select unit_id from public.profiles where id = auth.uid();
$$;

comment on function public.current_user_unit_id() is
  'Retorna unit_id do user atual (sua unidade "lar"). Usado em RLS '
  'pra filtrar dados das Fases 2-4.';
