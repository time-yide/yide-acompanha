-- supabase/migrations/20260710000000_user_role_fast_midia.sql
-- Novo cargo: Fast Mídia (responsável pelos stories de clientes). Não ganha %.
alter type public.user_role add value if not exists 'fast_midia';
