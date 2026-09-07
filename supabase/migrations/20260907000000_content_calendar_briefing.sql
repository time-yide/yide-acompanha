-- Adiciona campo de briefing do assessor ao cronograma de conteúdo.
-- O assessor preenche antes da geração com ideias, temas e contexto do cliente.
ALTER TABLE content_calendars
  ADD COLUMN IF NOT EXISTS briefing_assessor jsonb DEFAULT NULL;

COMMENT ON COLUMN content_calendars.briefing_assessor IS
  'Briefing preenchido pelo assessor antes da geração (temas, promoções, ideias do cliente, etc.)';
