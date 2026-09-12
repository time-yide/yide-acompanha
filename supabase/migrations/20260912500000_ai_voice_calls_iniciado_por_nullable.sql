-- Permite ligações automáticas (motor) sem user session
ALTER TABLE public.ai_voice_calls
  ALTER COLUMN iniciado_por DROP NOT NULL;
