-- member_ids: array dos 2 user_ids participantes do DM. NULL pra canais
-- de grupo (kind != 'direct').
ALTER TABLE chat_channels
  ADD COLUMN IF NOT EXISTS member_ids UUID[];

-- Unique index parcial: garante 1 DM por par. LEAST/GREATEST normalizam
-- a ordem do par pra que [A,B] e [B,A] sejam tratados como o mesmo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_channels_dm_unique
  ON chat_channels (
    LEAST((member_ids)[1], (member_ids)[2]),
    GREATEST((member_ids)[1], (member_ids)[2])
  )
  WHERE kind = 'direct';

-- GIN index pra listar DMs onde um user_id está em member_ids.
CREATE INDEX IF NOT EXISTS idx_chat_channels_member_ids_gin
  ON chat_channels USING GIN (member_ids)
  WHERE kind = 'direct';
