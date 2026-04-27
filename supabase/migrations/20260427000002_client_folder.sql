-- supabase/migrations/20260427000002_client_folder.sql

-- 1) Briefing (1:1 com cliente)
create table public.client_briefing (
  client_id uuid primary key references public.clients(id) on delete cascade,
  texto_markdown text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create trigger trg_client_briefing_updated_at
  before update on public.client_briefing
  for each row execute function public.set_updated_at();

alter table public.client_briefing enable row level security;

create policy "authenticated read briefing"
  on public.client_briefing for select to authenticated using (true);

create policy "adm/socio insert briefing"
  on public.client_briefing for insert to authenticated
  with check (public.current_user_role() in ('adm', 'socio'));

create policy "edit briefing of own client"
  on public.client_briefing for update to authenticated
  using (
    public.current_user_role() in ('adm', 'socio')
    or exists (
      select 1 from public.clients c
      where c.id = client_briefing.client_id
        and (c.assessor_id = auth.uid() or c.coordenador_id = auth.uid())
    )
  );

-- 2) Notes/Reuniões
create type public.note_type as enum ('reuniao', 'observacao', 'mudanca_status');

create table public.client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  autor_id uuid not null references public.profiles(id),
  tipo public.note_type not null default 'reuniao',
  texto_rico text not null,
  created_at timestamptz not null default now()
);

create index idx_client_notes_client on public.client_notes(client_id, created_at desc);

alter table public.client_notes enable row level security;

create policy "authenticated read notes"
  on public.client_notes for select to authenticated using (true);

create policy "authenticated insert own notes"
  on public.client_notes for insert to authenticated
  with check (autor_id = auth.uid());

create policy "author can update own notes"
  on public.client_notes for update to authenticated
  using (autor_id = auth.uid());

create policy "author or adm/socio can delete notes"
  on public.client_notes for delete to authenticated
  using (autor_id = auth.uid() or public.current_user_role() in ('adm', 'socio'));

-- 3) Files
create type public.file_category as enum ('briefing', 'contrato', 'criativo', 'outro');

create table public.client_files (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  categoria public.file_category not null default 'outro',
  nome_arquivo text not null,
  storage_path text not null,
  size_bytes bigint not null,
  mime_type text,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index idx_client_files_client on public.client_files(client_id, created_at desc);

alter table public.client_files enable row level security;

create policy "authenticated read files"
  on public.client_files for select to authenticated using (true);

create policy "authenticated upload files"
  on public.client_files for insert to authenticated
  with check (uploaded_by = auth.uid());

create policy "uploader or adm/socio can delete files"
  on public.client_files for delete to authenticated
  using (uploaded_by = auth.uid() or public.current_user_role() in ('adm', 'socio'));

-- 4) Important dates
create type public.important_date_type as enum ('aniversario_socio', 'renovacao', 'kickoff', 'custom');

create table public.client_important_dates (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  tipo public.important_date_type not null default 'custom',
  data date not null,
  descricao text not null,
  notify_days_before integer[] not null default array[30, 7, 1],
  created_at timestamptz not null default now()
);

create index idx_client_dates_client on public.client_important_dates(client_id, data);

alter table public.client_important_dates enable row level security;

create policy "authenticated read dates"
  on public.client_important_dates for select to authenticated using (true);

create policy "manage dates of own client"
  on public.client_important_dates for all to authenticated
  using (
    public.current_user_role() in ('adm', 'socio')
    or exists (
      select 1 from public.clients c
      where c.id = client_important_dates.client_id
        and (c.assessor_id = auth.uid() or c.coordenador_id = auth.uid())
    )
  );
