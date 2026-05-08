-- Status manual "concluída" pra captação. NULL = ainda em fluxo (pendente
-- ou delegada). Timestamp = quando foi marcada como concluída + por quem
-- (audit log já cobre o "por quem").
-- Esse status é independente da delegação — admin pode marcar como
-- concluída diretamente caso a captação não precise de edit, ou já tenha
-- sido publicada por outro caminho.
ALTER TABLE audiovisual_capturas
  ADD COLUMN IF NOT EXISTS concluida_em TIMESTAMPTZ;
