-- Aportes de capital dos sócios: dinheiro colocado na empresa (não é receita).
-- Alimenta a visão de fluxo de caixa em /financeiro/caixa.
-- Entrada de caixa = Recebido (client_payments pago) + Aportes.
-- Só sócio lê/escreve (RLS via current_user_role()).

create table public.capital_aportes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  data date not null,
  valor numeric(12,2) not null check (valor > 0),
  socio_id uuid not null references public.profiles(id),
  tipo text not null default 'capital' check (tipo in ('capital', 'emprestimo')),
  descricao text null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_capital_aportes_org_data
  on public.capital_aportes(organization_id, data);

create trigger trg_capital_aportes_updated_at
  before update on public.capital_aportes
  for each row execute function public.set_updated_at();

alter table public.capital_aportes enable row level security;

create policy "capital_aportes rw socio"
  on public.capital_aportes for all to authenticated
  using (public.current_user_role() = 'socio')
  with check (public.current_user_role() = 'socio');
