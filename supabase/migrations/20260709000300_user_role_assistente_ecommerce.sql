-- supabase/migrations/20260709000300_user_role_assistente_ecommerce.sql
-- Novo cargo: Assistente de e-commerce (separado do Assessor de e-commerce).
-- Não ganha comissão (o calculator já trata roles fora da lista como só fixo).
alter type public.user_role add value if not exists 'assistente_ecommerce';
