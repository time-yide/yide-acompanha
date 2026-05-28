-- =====================================================
-- FREELAYIDE — Painel interno de captação extra (MVP)
-- =====================================================

-- 1) Oportunidades (cada "lead" curado pra captação)
create table if not exists public.freela_oportunidades (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  titulo text not null,
  descricao text,
  cliente_nome text,
  contato text,
  valor_comissao numeric(12,2) not null default 0,

  status text not null default 'disponivel'
    check (status in ('disponivel','pega','em_negociacao','fechada','perdida')),

  pego_por uuid references public.profiles(id) on delete set null,
  pego_em timestamptz,
  negociacao_em timestamptz,
  fechada_em timestamptz,

  criado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists freela_op_org_idx
  on public.freela_oportunidades(organization_id, created_at desc)
  where deleted_at is null;
create index if not exists freela_op_pego_idx
  on public.freela_oportunidades(pego_por, pego_em desc)
  where deleted_at is null;

alter table public.freela_oportunidades enable row level security;

drop policy if exists freela_op_select on public.freela_oportunidades;
create policy freela_op_select on public.freela_oportunidades
  for select to authenticated using (true);
drop policy if exists freela_op_insert on public.freela_oportunidades;
create policy freela_op_insert on public.freela_oportunidades
  for insert to authenticated with check (true);
drop policy if exists freela_op_update on public.freela_oportunidades;
create policy freela_op_update on public.freela_oportunidades
  for update to authenticated using (true);

-- 2) Metas mensais de equipe
create table if not exists public.freela_metas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mes date not null,
  descricao text not null,
  tipo_alvo text not null default 'pontos'
    check (tipo_alvo in ('pontos','fechamentos','comissao')),
  alvo numeric(12,2) not null default 0,
  bonus_descricao text,
  criado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, mes)
);

alter table public.freela_metas enable row level security;

drop policy if exists freela_metas_select on public.freela_metas;
create policy freela_metas_select on public.freela_metas
  for select to authenticated using (true);
drop policy if exists freela_metas_insert on public.freela_metas;
create policy freela_metas_insert on public.freela_metas
  for insert to authenticated with check (true);
drop policy if exists freela_metas_update on public.freela_metas;
create policy freela_metas_update on public.freela_metas
  for update to authenticated using (true);
