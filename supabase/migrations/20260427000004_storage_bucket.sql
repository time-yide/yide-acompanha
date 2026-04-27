-- supabase/migrations/20260427000004_storage_bucket.sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-files',
  'client-files',
  false,
  52428800, -- 50MB
  null
)
on conflict (id) do nothing;

create policy "authenticated read client-files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'client-files');

create policy "authenticated upload client-files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'client-files');

create policy "owner or adm/socio delete client-files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'client-files'
    and (
      auth.uid() = owner
      or public.current_user_role() in ('adm', 'socio')
    )
  );
