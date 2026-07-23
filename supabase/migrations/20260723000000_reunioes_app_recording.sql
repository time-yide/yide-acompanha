-- supabase/migrations/20260723000000_reunioes_app_recording.sql
--
-- Fatia 1 do "Reuniões gravadas do cliente": grava pelo app (navegador).
-- Aplicação MANUAL no SQL Editor, DEPOIS de aplicar as migrations
-- 20260513000000_reunioes_fase1.sql e 20260515000000_reunioes_retencao.sql.

-- 1) Novo source: gravação feita pelo próprio app.
alter type public.meeting_source add value if not exists 'app_recording';

-- 2) Bucket privado pros áudios das reuniões.
insert into storage.buckets (id, name, public)
values ('meeting-recordings', 'meeting-recordings', false)
on conflict (id) do nothing;

-- 3) Policies de Storage: o app sobe/lê via service-role (bypassa RLS), mas
--    o upload direto do browser usa URL assinada (uploadToSignedUrl), que não
--    exige policy de INSERT pra usuário. Mantemos o bucket privado sem policies
--    públicas — acesso só via service-role/URL assinada.
