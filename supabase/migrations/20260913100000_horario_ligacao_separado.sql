-- Horário de ligação separado do horário de WPP.
-- Ligações param mais cedo (ex: 19:00), WPP pode ir até 20:00.

ALTER TABLE ai_voice_configs
  ADD COLUMN horario_inicio_ligacao text NOT NULL DEFAULT '08:30',
  ADD COLUMN horario_fim_ligacao text NOT NULL DEFAULT '19:00',
  ADD COLUMN horario_inicio_ligacao_fds text NOT NULL DEFAULT '09:00',
  ADD COLUMN horario_fim_ligacao_fds text NOT NULL DEFAULT '17:00';
