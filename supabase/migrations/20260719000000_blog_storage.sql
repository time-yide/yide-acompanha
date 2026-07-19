-- Bucket público pras capas do blog (imagens geradas pelo pipeline de IA).
insert into storage.buckets (id, name, public)
values ('blog', 'blog', true)
on conflict (id) do nothing;

-- Leitura pública dos objetos do bucket (a URL pública precisa disso).
drop policy if exists "blog_bucket_public_read" on storage.objects;
create policy "blog_bucket_public_read" on storage.objects
  for select using (bucket_id = 'blog');
