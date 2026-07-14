-- Adiciona 'grupo' ao enum chat_channel_kind pra suportar grupos customizados
-- (canal com nome + membros escolhidos a dedo, acesso por member_ids).
-- ALTER TYPE ... ADD VALUE precisa rodar isolada (regra Postgres) — por isso
-- fica numa migration só, antes da que usa o valor.

ALTER TYPE public.chat_channel_kind ADD VALUE IF NOT EXISTS 'grupo';
