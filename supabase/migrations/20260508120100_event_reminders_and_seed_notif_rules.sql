-- Coluna pra impedir lembrete 30min duplicado. Index parcial otimiza o
-- query do cron a cada 5 min: filtra eventos por inicio mas ignora os
-- já lembrados.

ALTER TABLE calendar_events
  ADD COLUMN reminded_30min_at TIMESTAMPTZ;

CREATE INDEX idx_calendar_events_inicio_pending_reminder
  ON calendar_events (inicio)
  WHERE reminded_30min_at IS NULL;

-- Seeds das 3 novas regras como mandatory.
-- email_default=false em todas: notif por email pra cada msg/evento
-- seria spam pesado.
-- permite_destinatarios_extras=true: dispatcher passa participantes_ids
-- (calendário) ou destinatários do canal (chat) via user_ids_extras.
INSERT INTO notification_rules
  (evento_tipo, ativo, mandatory, email_default, permite_destinatarios_extras, default_roles, default_user_ids)
VALUES
  ('evento_calendario_amanha', true, true, false, true, '{}', '{}'),
  ('evento_calendario_30min',  true, true, false, true, '{}', '{}'),
  ('chat_mensagem',            true, true, false, true, '{}', '{}')
ON CONFLICT (evento_tipo) DO NOTHING;
