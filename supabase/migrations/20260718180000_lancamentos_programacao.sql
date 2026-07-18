-- Setor Programação: registro manual de entregas (CRM conectado, usuário criado,
-- sistema feito) por cliente. Espelha anuncios_ecommerce.
create table if not exists public.lancamentos_programacao (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  colaborador_id uuid references public.profiles(id) on delete set null,
  data date not null default current_date,
  tipo text not null check (tipo in ('crm_conectado','usuario_criado','sistema_feito')),
  quantidade integer not null check (quantidade > 0),
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  arquivado_em timestamptz
);

create index if not exists lancamentos_programacao_org_data_idx
  on public.lancamentos_programacao(organization_id, data desc) where arquivado_em is null;
create index if not exists lancamentos_programacao_client_idx
  on public.lancamentos_programacao(client_id) where arquivado_em is null;
create index if not exists lancamentos_programacao_colaborador_idx
  on public.lancamentos_programacao(colaborador_id) where arquivado_em is null;

drop trigger if exists lancamentos_programacao_set_updated_at on public.lancamentos_programacao;
create trigger lancamentos_programacao_set_updated_at
  before update on public.lancamentos_programacao
  for each row execute function public.set_updated_at();

alter table public.lancamentos_programacao enable row level security;
drop policy if exists lancamentos_programacao_select on public.lancamentos_programacao;
create policy lancamentos_programacao_select on public.lancamentos_programacao for select to authenticated using (true);
drop policy if exists lancamentos_programacao_insert on public.lancamentos_programacao;
create policy lancamentos_programacao_insert on public.lancamentos_programacao for insert to authenticated with check (true);
drop policy if exists lancamentos_programacao_update on public.lancamentos_programacao;
create policy lancamentos_programacao_update on public.lancamentos_programacao for update to authenticated using (true);
