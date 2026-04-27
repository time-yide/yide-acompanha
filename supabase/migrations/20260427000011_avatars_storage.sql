-- supabase/migrations/20260427000011_avatars_storage.sql
-- Bucket público de avatares de colaboradores. Path: {user_id}/avatar.{ext}.
-- Policies: usuários atualizam seu próprio avatar; ADM/Sócio podem atualizar qualquer um.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "users upload own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "adm/socio upload any avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and public.current_user_role() in ('adm','socio'));

create policy "anyone read avatars"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars');

create policy "users update own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "adm/socio update any avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and public.current_user_role() in ('adm','socio'));
