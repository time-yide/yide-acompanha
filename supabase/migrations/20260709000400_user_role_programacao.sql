-- supabase/migrations/20260709000400_user_role_programacao.sql
-- Novo cargo: Programação (cargo técnico — CRM/integrações/analytics futuros).
-- Não ganha comissão (o calculator trata roles fora da lista como só fixo).
alter type public.user_role add value if not exists 'programacao';
