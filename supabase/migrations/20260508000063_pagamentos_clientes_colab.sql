-- Tabelas pra rastreio MANUAL de pagamentos: cliente (recebimento) e
-- colaborador (folha + comissão). ADM/sócio marcam "pago"/"pendente"
-- por mês. Não integra com banco — é só registro interno.

-- ─── client_payments ─────────────────────────────────────────────────────
create table public.client_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  mes_referencia text not null check (mes_referencia ~ '^\d{4}-\d{2}$'),
  status text not null default 'pago' check (status in ('pago', 'pendente')),
  paid_at timestamptz null,
  marked_by uuid not null references public.profiles(id),
  observacao text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index uq_client_payments_client_mes
  on public.client_payments(client_id, mes_referencia);
create index idx_client_payments_org_mes
  on public.client_payments(organization_id, mes_referencia);

create trigger trg_client_payments_updated_at
  before update on public.client_payments
  for each row execute function public.set_updated_at();

alter table public.client_payments enable row level security;

create policy "client_payments rw socio adm"
  on public.client_payments for all to authenticated
  using (public.current_user_role() in ('socio', 'adm'))
  with check (public.current_user_role() in ('socio', 'adm'));


-- ─── payroll_payments ────────────────────────────────────────────────────
create table public.payroll_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  mes_referencia text not null check (mes_referencia ~ '^\d{4}-\d{2}$'),
  status text not null default 'pago' check (status in ('pago', 'pendente')),
  paid_at timestamptz null,
  marked_by uuid not null references public.profiles(id),
  observacao text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index uq_payroll_payments_user_mes
  on public.payroll_payments(user_id, mes_referencia);
create index idx_payroll_payments_org_mes
  on public.payroll_payments(organization_id, mes_referencia);

create trigger trg_payroll_payments_updated_at
  before update on public.payroll_payments
  for each row execute function public.set_updated_at();

alter table public.payroll_payments enable row level security;

create policy "payroll_payments rw socio adm"
  on public.payroll_payments for all to authenticated
  using (public.current_user_role() in ('socio', 'adm'))
  with check (public.current_user_role() in ('socio', 'adm'));
