-- Adiciona o role 'videomaker_mobile' ao enum user_role.
-- Permite diferenciar videomakers de câmera profissional (videomaker)
-- de videomakers que gravam só com celular (videomaker_mobile).
--
-- Uso: cliente com captação entregue por user role=videomaker → marca
-- CAM no painel mensal. Entregue por user role=videomaker_mobile → MOB.
--
-- IMPORTANTE: ALTER TYPE ADD VALUE precisa rodar fora de transação no
-- Postgres antigo. Em Postgres 12+ funciona dentro também — Supabase usa
-- 15+, então OK. Mas tem um catch: o novo valor só fica visível APÓS o
-- commit, então não pode ser usado na mesma migration.

alter type public.user_role add value if not exists 'videomaker_mobile';
