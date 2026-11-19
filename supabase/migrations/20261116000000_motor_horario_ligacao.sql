-- Motor de prospecção: horário de ligação IA separado do horário de WhatsApp.
-- Ligações param mais cedo (padrão 19:00 seg-sex) que o WPP (padrão 20:00).
-- Aditiva: colunas novas com default; linhas existentes recebem o padrão.

ALTER TABLE public.ai_voice_configs
  ADD COLUMN IF NOT EXISTS horario_inicio_ligacao time NOT NULL DEFAULT '08:30',
  ADD COLUMN IF NOT EXISTS horario_fim_ligacao time NOT NULL DEFAULT '19:00',
  ADD COLUMN IF NOT EXISTS horario_inicio_ligacao_fds time NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS horario_fim_ligacao_fds time NOT NULL DEFAULT '17:00';

-- Novo padrão do WhatsApp seg-sex vai até 20:00 (só afeta configs novas).
ALTER TABLE public.ai_voice_configs
  ALTER COLUMN horario_fim SET DEFAULT '20:00';
