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
  -- ID do arquivo no Drive, conferido pela server action (files.get) antes de
  -- gravar. Único: reenviar o mesmo "confirmar" não duplica histórico.
  drive_file_id text not null
    constraint drive_uploads_drive_file_id_key unique
    constraint drive_uploads_drive_file_id_check
    check (drive_file_id ~ '^[A-Za-z0-9_-]+$'),
  size_bytes bigint,
  folder_url text not null
    constraint drive_uploads_folder_url_check
    check (folder_url ~ '^https://drive\.google\.com/drive/folders/[A-Za-z0-9_-]+$'),
  created_at timestamptz not null default now()
);

create index if not exists idx_drive_uploads_client on public.drive_uploads(client_id);
create index if not exists idx_drive_uploads_created on public.drive_uploads(created_at desc);

alter table public.drive_uploads enable row level security;

-- Escopo de leitura (espelhado em escopoHistoricoDrive, src/lib/google-drive/schema.ts):
--  - gestão (adm, socio, coordenador, assessor, audiovisual_chefe): uploads de
--    clientes que o usuário enxerga. O subselect em clients roda sob a RLS de
--    clients ("clients select by unit"), então respeita a unidade;
--  - videomaker, fast_midia, editor: só linhas que ele mesmo subiu ou de
--    cliente em que ele é o editor (e que ele enxerga);
--  - qualquer outro papel: nada.
create policy "drive_uploads_select" on public.drive_uploads
  for select to authenticated
  using (
    exists (select 1 from public.clients c where c.id = drive_uploads.client_id)
    and (
      (select role::text from public.profiles where id = auth.uid())
        in ('adm','socio','coordenador','assessor','audiovisual_chefe')
      or (
        (select role::text from public.profiles where id = auth.uid())
          in ('videomaker','fast_midia','editor')
        and (
          drive_uploads.uploaded_by = auth.uid()
          or exists (
            select 1 from public.clients c2
            where c2.id = drive_uploads.client_id and c2.editor_id = auth.uid()
          )
        )
      )
    )
  );

-- Sem policy de INSERT/UPDATE/DELETE: só a server action escreve (service
-- role), com cliente/categoria/pasta tirados de um token assinado no
-- "preparar envio" e cada arquivo conferido no Drive.
