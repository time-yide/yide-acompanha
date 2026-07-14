-- Grupos customizados no Escritório Virtual: canal kind='grupo' com nome +
-- membros escolhidos a dedo (member_ids), criado por adm/sócio.
-- APLICAR DEPOIS da 20260714000000 (que adiciona o valor 'grupo' ao enum).

-- 1) Quem criou o grupo (pra gerenciamento: editar membros / apagar).
ALTER TABLE public.chat_channels
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);

-- 2) Permite VÁRIOS grupos (e DMs). O UNIQUE(kind) original só deixava 1 canal
--    por tipo. Troca por um índice único parcial que ignora direct/grupo, mas
--    mantém a unicidade dos canais fixos (geral, designers, etc.).
ALTER TABLE public.chat_channels DROP CONSTRAINT IF EXISTS chat_channels_kind_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_channels_kind_fixed_unique
  ON public.chat_channels (kind)
  WHERE kind NOT IN ('direct', 'grupo');

-- 3) GIN pra listar grupos onde o user está em member_ids (espelha o de direct).
CREATE INDEX IF NOT EXISTS idx_chat_channels_grupo_members_gin
  ON public.chat_channels USING gin (member_ids)
  WHERE kind = 'grupo';

-- 4) Acesso por LISTA DE MEMBROS no RLS de mensagens (direct + grupo). Canais
--    role-based têm member_ids NULL, então a regra nova nunca os afeta. De
--    quebra, deixa as DMs sólidas (o RLS antigo só cobria canais por cargo).
DROP POLICY IF EXISTS "messages read members" ON public.chat_messages;
CREATE POLICY "messages read members"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_channels c
      WHERE c.id = channel_id
        AND (
          public.can_access_chat_channel(auth.uid(), c.kind)
          OR (c.member_ids IS NOT NULL AND auth.uid() = ANY(c.member_ids))
        )
    )
  );

DROP POLICY IF EXISTS "messages insert members" ON public.chat_messages;
CREATE POLICY "messages insert members"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chat_channels c
      WHERE c.id = channel_id
        AND (
          public.can_access_chat_channel(auth.uid(), c.kind)
          OR (c.member_ids IS NOT NULL AND auth.uid() = ANY(c.member_ids))
        )
    )
  );
