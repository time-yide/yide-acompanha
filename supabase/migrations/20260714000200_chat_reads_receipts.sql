-- Read receipts ("quem leu") no Escritório Virtual.
-- 1) O SELECT em chat_reads era só da própria leitura. Pra ver "quem leu",
--    membros de um canal precisam ver a leitura uns dos outros (só desse canal).
-- 2) Realtime na chat_reads pra o ✓✓ atualizar na hora que a pessoa lê.

DROP POLICY IF EXISTS "reads select own" ON public.chat_reads;
CREATE POLICY "reads select channel members"
  ON public.chat_reads FOR SELECT TO authenticated
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

-- Realtime: postgres_changes na chat_reads. REPLICA IDENTITY FULL garante que o
-- evento traga user_id/channel_id/last_read_at completos.
ALTER TABLE public.chat_reads REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_reads;
