-- supabase/migrations/20260427000001_clients.sql
create type public.client_status as enum ('ativo', 'churn', 'em_onboarding');

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  nome text not null,
  contato_principal text,
  email text,
  telefone text,
  valor_mensal numeric(12, 2) not null default 0,
  servico_contratado text,
  status public.client_status not null default 'ativo',
  data_entrada date not null default current_date,
  data_churn date,
  motivo_churn text,
  assessor_id uuid references public.profiles(id) on delete set null,
  coordenador_id uuid references public.profiles(id) on delete set null,
  data_aniversario_socio_cliente date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_clients_status on public.clients(status);
create index idx_clients_assessor on public.clients(assessor_id);
create index idx_clients_coordenador on public.clients(coordenador_id);

create trigger trg_clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

alter table public.clients enable row level security;

create policy "authenticated can view clients"
  on public.clients for select
  to authenticated
  using (true);

create policy "adm/socio can insert clients"
  on public.clients for insert
  to authenticated
  with check (public.current_user_role() in ('adm', 'socio'));

create policy "adm/socio can update any client"
  on public.clients for update
  to authenticated
  using (public.current_user_role() in ('adm', 'socio'))
  with check (public.current_user_role() in ('adm', 'socio'));

create policy "coord/assessor can update own clients"
  on public.clients for update
  to authenticated
  using (
    public.current_user_role() in ('coordenador', 'assessor')
    and (assessor_id = auth.uid() or coordenador_id = auth.uid())
  )
  with check (
    public.current_user_role() in ('coordenador', 'assessor')
    and (assessor_id = auth.uid() or coordenador_id = auth.uid())
  );
