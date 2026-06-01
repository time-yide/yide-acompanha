-- supabase/migrations/20260621000000_editor_ia.sql
-- Editor de vídeo com IA (MVP): jobs + bucket de storage.

create table if not exists public.editor_ia_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'enviando'
    check (status in ('enviando','transcrevendo','planejando','aguardando_revisao','renderizando','pronto','erro')),
  instrucao text,
  video_url text,
  video_duracao_segundos int,
  transcricao jsonb,
  edit_plan jsonb,
  shotstack_render_id text,
  output_url text,
  srt_url text,
  erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists editor_ia_jobs_org_idx
  on public.editor_ia_jobs(organization_id, created_at desc);
create index if not exists editor_ia_jobs_user_idx
  on public.editor_ia_jobs(user_id, created_at desc);

drop trigger if exists editor_ia_jobs_set_updated_at on public.editor_ia_jobs;
create trigger editor_ia_jobs_set_updated_at
  before update on public.editor_ia_jobs
  for each row execute function public.set_updated_at();

alter table public.editor_ia_jobs enable row level security;
drop policy if exists editor_ia_jobs_select on public.editor_ia_jobs;
create policy editor_ia_jobs_select on public.editor_ia_jobs for select to authenticated using (true);
drop policy if exists editor_ia_jobs_insert on public.editor_ia_jobs;
create policy editor_ia_jobs_insert on public.editor_ia_jobs for insert to authenticated with check (true);
drop policy if exists editor_ia_jobs_update on public.editor_ia_jobs;
create policy editor_ia_jobs_update on public.editor_ia_jobs for update to authenticated using (true);

-- Bucket privado pra entrada/saída
insert into storage.buckets (id, name, public)
values ('editor-ia', 'editor-ia', false)
on conflict (id) do nothing;
