-- Histórico de uploads pro Google Drive via sistema
create table drive_uploads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  uploaded_by uuid not null references profiles(id),
  categoria text not null,
  nome_original text not null,
  nome_drive text not null,
  size_bytes bigint,
  folder_url text not null,
  created_at timestamptz not null default now()
);

create index idx_drive_uploads_client on drive_uploads(client_id);
create index idx_drive_uploads_created on drive_uploads(created_at desc);

-- RLS
alter table drive_uploads enable row level security;

create policy "drive_uploads_select" on drive_uploads
  for select using (
    (select role from profiles where id = auth.uid())
    in ('adm','socio','coordenador','assessor','audiovisual_chefe','videomaker','fast_midia','editor')
  );

create policy "drive_uploads_insert" on drive_uploads
  for insert with check (
    uploaded_by = auth.uid()
    and (select role from profiles where id = auth.uid())
    in ('adm','socio','coordenador','assessor','audiovisual_chefe','videomaker','fast_midia','editor')
  );
