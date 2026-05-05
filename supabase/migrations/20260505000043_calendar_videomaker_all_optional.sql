-- supabase/migrations/20260505000043_calendar_videomaker_all_optional.sql
-- Remove de vez a constraint chk_videomaker_required_fields. Agora todos os
-- campos do bloco "videomakers" (endereço, maps, roteiro, observações) são
-- 100% opcionais. Quem cria preenche o que tiver na hora; videomaker
-- complementa depois.

alter table public.calendar_events
  drop constraint if exists chk_videomaker_required_fields;
