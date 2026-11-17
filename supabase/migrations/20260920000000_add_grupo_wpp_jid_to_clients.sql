-- Add WhatsApp group JID to clients for automated follow-ups
ALTER TABLE clients ADD COLUMN IF NOT EXISTS grupo_wpp_jid text;

COMMENT ON COLUMN clients.grupo_wpp_jid IS 'WhatsApp group JID (e.g. 5565...@g.us) for automated follow-up messages via Evolution API';
