-- supabase/migrations/20260427000010_user_role_extend.sql
-- Adiciona 4 valores ao enum user_role: 3 produtores audiovisuais + 1 supervisor.
alter type public.user_role add value 'videomaker';
alter type public.user_role add value 'designer';
alter type public.user_role add value 'editor';
alter type public.user_role add value 'audiovisual_chefe';
