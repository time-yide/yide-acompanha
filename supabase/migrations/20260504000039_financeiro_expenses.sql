-- supabase/migrations/20260504000039_financeiro_expenses.sql
-- Tabelas pra Financeiro Phase 1: catálogo de despesas + overrides mensais.
-- RLS estrita: só sócio lê/escreve.

-- ─── expenses ──────────────────────────────────────────────────────────────
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  descricao text not null,
  categoria text not null check (categoria in (
    'aluguel', 'software', 'contabilidade', 'impostos',
    'marketing_proprio', 'equipamento', 'pro_labore', 'outros'
  )),
  tipo text not null check (tipo in ('fixa', 'avulsa')),
  valor numeric(14, 2) not null check (valor >= 0),

  -- Avulsa: mês do lançamento (YYYY-MM). Fixa: null.
  mes_referencia text null check (
    (tipo = 'avulsa' and mes_referencia ~ '^\d{4}-\d{2}$')
    or (tipo = 'fixa' and mes_referencia is null)
  ),

  -- Fixa: vigência (inclusivo no início, exclusivo no fim). Null = sem limite.
  inicio_mes text null check (inicio_mes is null or inicio_mes ~ '^\d{4}-\d{2}$'),
  fim_mes text null check (fim_mes is null or fim_mes ~ '^\d{4}-\d{2}$'),

  notas text null,
  criado_por uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expenses_org_tipo on public.expenses(organization_id, tipo);
create index expenses_avulsa_mes on public.expenses(organization_id, mes_referencia)
  where tipo = 'avulsa';

alter table public.expenses enable row level security;

create policy "socio rw expenses" on public.expenses
  for all to authenticated
  using (current_user_role() = 'socio'::user_role)
  with check (current_user_role() = 'socio'::user_role);

-- ─── expense_overrides ──────────────────────────────────────────────────────
create table public.expense_overrides (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  mes_referencia text not null check (mes_referencia ~ '^\d{4}-\d{2}$'),
  valor numeric(14, 2) not null check (valor >= 0),
  motivo text null,
  criado_por uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (expense_id, mes_referencia)
);

create index expense_overrides_mes on public.expense_overrides(mes_referencia);

alter table public.expense_overrides enable row level security;

create policy "socio rw expense_overrides" on public.expense_overrides
  for all to authenticated
  using (current_user_role() = 'socio'::user_role)
  with check (current_user_role() = 'socio'::user_role);

-- ─── trigger updated_at ─────────────────────────────────────────────────────
create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();
