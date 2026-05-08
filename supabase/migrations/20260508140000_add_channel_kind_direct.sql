-- Adiciona 'direct' ao enum channel_kind pra suportar DMs entre 2 users.
-- ALTER TYPE ... ADD VALUE precisa rodar isolada (regra Postgres).

ALTER TYPE channel_kind ADD VALUE IF NOT EXISTS 'direct';
