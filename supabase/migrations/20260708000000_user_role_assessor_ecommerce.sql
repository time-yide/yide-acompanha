-- supabase/migrations/20260708000000_user_role_assessor_ecommerce.sql
-- Adiciona o papel do setor de e-commerce ao enum user_role.
-- ADD VALUE fica isolado: não pode ser usado na mesma transação em que é criado.
alter type public.user_role add value if not exists 'assessor_ecommerce';
