-- Fotos em recados: coluna de anexos + bucket público dedicado.
-- Upload é direto do browser via signed URL (fura o bodySizeLimit de 2MB do
-- Server Action), mesmo padrão do escritório/social-media.

alter table public.recados
  add column attachment_urls text[] not null default '{}';

-- Bucket público pras imagens de recado.
insert into storage.buckets (id, name, public)
values ('recado-attachments', 'recado-attachments', true)
on conflict (id) do nothing;

create policy "recado-attachments read"
  on storage.objects for select to authenticated
  using (bucket_id = 'recado-attachments');

create policy "recado-attachments insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'recado-attachments');

create policy "recado-attachments delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'recado-attachments' and owner = auth.uid());
