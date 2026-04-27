-- supabase/migrations/20260427000005_leads.sql
create type public.lead_stage as enum (
  'prospeccao', 'comercial', 'contrato', 'marco_zero', 'ativo'
);
create type public.lead_priority as enum ('alta', 'media', 'baixa');

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  nome_prospect text not null,
  site text,
  contato_principal text,
  email text,
  telefone text,
  valor_proposto numeric(12, 2) default 0 not null,
  duracao_meses integer,
  servico_proposto text,
  info_briefing text,
  comercial_id uuid not null references public.profiles(id),
  stage public.lead_stage not null default 'prospeccao',
  prioridade public.lead_priority not null default 'media',
  data_prospeccao_agendada timestamptz,
  data_reuniao_marco_zero timestamptz,
  coord_alocado_id uuid references public.profiles(id) on delete set null,
  assessor_alocado_id uuid references public.profiles(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  data_fechamento date,
  motivo_perdido text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_leads_stage on public.leads(stage);
create index idx_leads_comercial on public.leads(comercial_id);
create index idx_leads_data_marco on public.leads(data_reuniao_marco_zero);

create trigger trg_leads_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

alter table public.leads enable row level security;

create policy "authenticated read leads"
  on public.leads for select to authenticated using (true);

create policy "comercial/adm/socio insert leads"
  on public.leads for insert to authenticated
  with check (
    public.current_user_role() in ('adm', 'socio', 'comercial')
    and comercial_id = auth.uid()
  );

create policy "adm/socio update any lead"
  on public.leads for update to authenticated
  using (public.current_user_role() in ('adm', 'socio'))
  with check (public.current_user_role() in ('adm', 'socio'));

create policy "comercial update own leads"
  on public.leads for update to authenticated
  using (
    public.current_user_role() = 'comercial'
    and comercial_id = auth.uid()
  )
  with check (
    public.current_user_role() = 'comercial'
    and comercial_id = auth.uid()
  );

create policy "coord update leads in marco_zero"
  on public.leads for update to authenticated
  using (
    public.current_user_role() = 'coordenador'
    and stage = 'marco_zero'
  )
  with check (
    public.current_user_role() = 'coordenador'
    and stage in ('marco_zero', 'ativo')
  );
