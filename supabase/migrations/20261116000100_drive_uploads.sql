-- Histórico de vídeos enviados pro Google Drive pelo sistema
-- (/audiovisual/upload-drive e "Subir vídeos pro Drive" na entrega de captação).
-- Os arquivos ficam no Drive; aqui só o registro de quem subiu o quê e onde.
create table if not exists public.drive_uploads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  categoria text not null,
  nome_original text not null,
  nome_drive text not null,
  drive_file_id text
    constraint drive_uploads_drive_file_id_check
    check (drive_file_id is null or drive_file_id ~ '^[A-Za-z0-9_-]+$'),
  size_bytes bigint,
  folder_url text not null
    constraint drive_uploads_folder_url_check
    check (folder_url ~ '^https://drive\.google\.com/drive/folders/[A-Za-z0-9_-]+$'),
  created_at timestamptz not null default now()
);

create index if not exists idx_drive_uploads_client on public.drive_uploads(client_id);
create index if not exists idx_drive_uploads_created on public.drive_uploads(created_at desc);

alter table public.drive_uploads enable row level security;

-- Escopo: além do papel, só enxerga upload de cliente que o próprio
-- usuário enxerga. O subselect em clients roda sob a RLS de clients
-- ("clients select by unit"), então o histórico respeita a unidade.
-- Papéis operacionais (videomaker/fast_midia/editor) são filtrados de novo na
-- aplicação (só os próprios envios / clientes onde é o editor).

create policy "drive_uploads_select" on public.drive_uploads
  for select to authenticated
  using (
    (select role::text from public.profiles where id = auth.uid())
    in ('adm','socio','coordenador','assessor','audiovisual_chefe','videomaker','fast_midia','editor')
    and exists (select 1 from public.clients c where c.id = drive_uploads.client_id)
  );

-- Sem policy de INSERT: só a server action escreve (service role), depois de
-- validar o papel, o cliente (pelo client da sessão, sob a RLS de clients) e
-- o formato da URL.
