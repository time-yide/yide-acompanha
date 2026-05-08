-- Adiciona valores ao enum notification_event. Precisa rodar ANTES da
-- migration que insere notification_rules referenciando esses valores —
-- Postgres exige ALTER TYPE ... ADD VALUE em transação separada.

ALTER TYPE notification_event ADD VALUE IF NOT EXISTS 'evento_calendario_amanha';
ALTER TYPE notification_event ADD VALUE IF NOT EXISTS 'evento_calendario_30min';
ALTER TYPE notification_event ADD VALUE IF NOT EXISTS 'chat_mensagem';
