-- Foto custom dos canais de grupo. Admin/sócio sobe via /configuracoes/canais.
-- DMs (kind='direct') não usam essa coluna — display vem do avatar do outro membro.
ALTER TABLE chat_channels
  ADD COLUMN IF NOT EXISTS icon_url TEXT;
