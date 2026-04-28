-- supabase/migrations/20260428000019_checklist_tables.sql

-- Enums
create type public.checklist_step_status as enum (
  'pendente',
  'em_andamento',
  'pronto',
  'atrasada'
);

create type public.checklist_step_key as enum (
  'cronograma',
  'design',
  'tpg',
  'tpm',
  'valor_trafego',
  'gmn_post',
  'camera',
  'mobile',
  'edicao',
  'reuniao',
  'postagem'
);

-- =============================================
-- Tabela: client_monthly_checklist
-- =============================================
create table public.client_monthly_checklist (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mes_referencia text not null,
  pacote_post integer,
  quantidade_postada integer,
  valor_trafego_mes numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(client_id, mes_referencia)
);

create index idx_checklist_client_mes on public.client_monthly_checklist(client_id, mes_referencia);
create index idx_checklist_mes on public.client_monthly_checklist(mes_referencia);
create index idx_checklist_org on public.client_monthly_checklist(organization_id);

create trigger trg_checklist_updated_at
  before update on public.client_monthly_checklist
  for each row execute function public.set_updated_at();

alter table public.client_monthly_checklist enable row level security;

create policy "checklist select all authenticated"
  on public.client_monthly_checklist for select to authenticated using (true);

create policy "checklist update by team"
  on public.client_monthly_checklist for update to authenticated
  using (
    public.current_user_role() in ('socio', 'adm', 'coordenador') OR
    exists (
      select 1 from public.clients c
      where c.id = client_id AND (
        c.assessor_id = auth.uid() OR
        c.coordenador_id = auth.uid() OR
        c.designer_id = auth.uid() OR
        c.videomaker_id = auth.uid() OR
        c.editor_id = auth.uid()
      )
    )
  );

-- INSERT/DELETE: só service-role (cron)

-- =============================================
-- Tabela: checklist_step
-- =============================================
create table public.checklist_step (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.client_monthly_checklist(id) on delete cascade,
  step_key public.checklist_step_key not null,
  status public.checklist_step_status not null default 'pendente',
  responsavel_id uuid references public.profiles(id),
  iniciado_em timestamptz,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id),
  unique(checklist_id, step_key)
);

create index idx_step_checklist on public.checklist_step(checklist_id);
create index idx_step_responsavel_pendente on public.checklist_step(responsavel_id, status) where status != 'pronto';

alter table public.checklist_step enable row level security;

create policy "step select all authenticated"
  on public.checklist_step for select to authenticated using (true);

create policy "step update by responsavel or admin"
  on public.checklist_step for update to authenticated
  using (
    public.current_user_role() in ('socio', 'adm', 'coordenador') OR
    responsavel_id = auth.uid() OR
    exists (
      select 1 from public.client_monthly_checklist cmc
      join public.clients c on c.id = cmc.client_id
      where cmc.id = checklist_id AND c.assessor_id = auth.uid()
    )
  );

-- INSERT/DELETE: só service-role (cron)
