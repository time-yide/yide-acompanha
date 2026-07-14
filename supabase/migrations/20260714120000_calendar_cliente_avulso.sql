-- Cliente avulso (texto livre) em eventos do calendário.
-- Usado quando o cliente não está cadastrado — só rótulo no evento,
-- NÃO entra nas contagens do painel (que só olham client_id real).
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS cliente_avulso text;
