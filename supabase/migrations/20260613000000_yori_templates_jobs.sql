-- Yori: editor de vídeo com IA. Fase 1.
-- 2 tabelas: yori_templates (3 sistema + N customizados/org) e yori_jobs (pipeline).

create table public.yori_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  nome text not null,
  is_system boolean not null default false,
  base_template text not null
    check (base_template in ('submagic','tiktok','reels_box')),
  primary_color text not null,
  highlight_color text,
  font_family text not null
    check (font_family in ('inter','montserrat','bebas','oswald','poppins','roboto','anton','archivo_black')),
  font_size int not null check (font_size between 24 and 80),
  position text not null check (position in ('top','center','bottom')),
  position_y_offset int default 0,
  has_shadow boolean not null default true,
  shadow_intensity int default 50 check (shadow_intensity between 0 and 100),
  animation text not null check (animation in ('pop','fade','slide','none')),
  created_at timestamptz not null default now()
);

create index yori_templates_org_idx
  on public.yori_templates(organization_id, created_at desc)
  where is_system = false;

alter table public.yori_templates enable row level security;

create policy yori_templates_select on public.yori_templates
  for select to authenticated using (
    is_system = true
    or organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

create policy yori_templates_insert on public.yori_templates
  for insert to authenticated with check (
    is_system = false and user_id = auth.uid()
  );

create policy yori_templates_update on public.yori_templates
  for update to authenticated using (
    is_system = false and user_id = auth.uid()
  );

create policy yori_templates_delete on public.yori_templates
  for delete to authenticated using (
    is_system = false and user_id = auth.uid()
  );

-- Seed: 3 templates de sistema (UUIDs fixos pra referência estável)
insert into public.yori_templates
  (id, nome, is_system, base_template, primary_color, highlight_color,
   font_family, font_size, position, has_shadow, shadow_intensity, animation)
values
  ('00000000-0000-0000-0000-000000000001', 'Submagic', true, 'submagic',
   '#FFFFFF', '#FFD600', 'inter', 56, 'center', true, 70, 'pop'),
  ('00000000-0000-0000-0000-000000000002', 'TikTok Clássico', true, 'tiktok',
   '#FFFFFF', null, 'archivo_black', 48, 'bottom', true, 80, 'none'),
  ('00000000-0000-0000-0000-000000000003', 'Reels Box', true, 'reels_box',
   '#FFFFFF', null, 'inter', 42, 'bottom', false, 0, 'fade');

-- Tabela yori_jobs
create table public.yori_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  template_id uuid not null references public.yori_templates(id),

  video_filename text not null,
  video_path text,
  video_duration_seconds int,
  video_size_bytes bigint,

  status text not null default 'pending'
    check (status in ('pending','transcribing','rendering','done','error','cancelled')),
  progress_pct int default 0,
  error_message text,

  srt_path text,
  txt_path text,
  mp4_path text,
  transcription jsonb,
  downloaded_at timestamptz,

  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,

  whisper_cost_brl numeric(10,4),
  lambda_cost_brl numeric(10,4)
);

create index yori_jobs_user_recent_idx
  on public.yori_jobs(user_id, created_at desc);

create index yori_jobs_org_status_idx
  on public.yori_jobs(organization_id, status, created_at desc);

create index yori_jobs_pending_idx
  on public.yori_jobs(created_at)
  where status in ('pending','transcribing','rendering');

create index yori_jobs_undownloaded_idx
  on public.yori_jobs(user_id)
  where status = 'done' and downloaded_at is null;

alter table public.yori_jobs enable row level security;

create policy yori_jobs_select on public.yori_jobs
  for select to authenticated using (
    user_id = auth.uid()
    or organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

create policy yori_jobs_insert on public.yori_jobs
  for insert to authenticated with check (user_id = auth.uid());

create policy yori_jobs_update_service on public.yori_jobs
  for update to authenticated using (false);

-- Função pra checar quota da org no mês corrente
create or replace function public.check_yori_quota(p_org_id uuid)
returns boolean
language sql stable as $$
  select count(*) < 100
  from public.yori_jobs
  where organization_id = p_org_id
    and created_at >= date_trunc('month', now())
    and status != 'cancelled';
$$;
