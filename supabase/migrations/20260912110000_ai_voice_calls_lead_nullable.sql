-- Permite ligações de teste sem lead vinculado
alter table public.ai_voice_calls
  alter column lead_gerado_id drop not null;
