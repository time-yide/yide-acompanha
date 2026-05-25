-- supabase/migrations/20260610000000_pacote_ecommerce.sql
--
-- Adiciona o valor 'ecommerce' ao enum tipo_pacote. ALTER TYPE ... ADD
-- VALUE precisa rodar fora de transação no Postgres antigo; em PG13+
-- (Supabase usa 15+) funciona dentro de transação se o valor não for
-- usado na mesma transação. Esta migration só adiciona — uso virá
-- depois via app.
--
-- IF NOT EXISTS evita erro se já foi aplicado (idempotente).

alter type public.tipo_pacote add value if not exists 'ecommerce';
