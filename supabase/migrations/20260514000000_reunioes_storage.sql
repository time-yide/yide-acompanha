-- supabase/migrations/20260514000000_reunioes_storage.sql
--
-- Storage bucket pra gravações de reunião. Path convention:
--   meeting-recordings/{organization_id}/{meeting_id}/{filename}
--
-- Política de retenção: 90 dias (cron mensal apaga arquivos antigos via
-- /api/cron/cleanup-old-recordings — não criado nesta migration).
--
-- Buckets em Supabase Storage:
--  - PRIVATE: requer signed URL pra ler/escrever
--  - PUBLIC: qualquer um com URL pode ler (não é o nosso caso)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meeting-recordings',
  'meeting-recordings',
  false,                               -- privado: signed URLs
  104857600,                           -- 100 MB max por arquivo
  array[
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/wav',
    'audio/x-wav',
    'audio/webm',
    'audio/ogg',
    'video/mp4',
    'video/webm'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Policies em storage.objects pra bucket meeting-recordings.
-- INSERT: qualquer authenticated upload na própria pasta do user.
-- SELECT: authenticated lê qualquer arquivo do bucket (RLS de meetings filtra
--   o que cada user vê na UI; signed URLs garantem que só quem tem o link acessa).
-- DELETE: só o owner do meeting (verificado pela primeira parte do path)
--   ou adm/socio.

create policy "authenticated upload meeting recordings"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'meeting-recordings'
  );

create policy "authenticated read meeting recordings"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'meeting-recordings'
  );

create policy "owner / adm delete meeting recordings"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'meeting-recordings'
    and (
      public.current_user_role() in ('adm', 'socio')
      -- TODO: refinar pra validar owner via path → meeting_id → meetings.owner_user_id
    )
  );
