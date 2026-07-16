-- Fluxo de caixa histórico: recebido e saídas por mês, importados das planilhas
-- oficiais (2024/2025), que não estão no sistema cliente-a-cliente. O
-- /financeiro/caixa usa esta tabela pros meses históricos e calcula os recentes
-- do próprio sistema. Só sócio.
create table public.caixa_mensal (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mes_referencia text not null check (mes_referencia ~ '^\d{4}-\d{2}$'),
  recebido numeric(14,2) not null default 0,
  saidas numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index uq_caixa_mensal_org_mes on public.caixa_mensal(organization_id, mes_referencia);
create trigger trg_caixa_mensal_updated_at
  before update on public.caixa_mensal
  for each row execute function public.set_updated_at();
alter table public.caixa_mensal enable row level security;
create policy "caixa_mensal rw socio" on public.caixa_mensal for all to authenticated
  using (public.current_user_role() = 'socio')
  with check (public.current_user_role() = 'socio');
