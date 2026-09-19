-- Lead Scoring + Reengajamento Automático

-- 1. Coluna de score para priorização de leads
ALTER TABLE leads_gerados
  ADD COLUMN IF NOT EXISTS score integer DEFAULT 0;

-- 2. Colunas de reengajamento
ALTER TABLE leads_gerados
  ADD COLUMN IF NOT EXISTS reengajamento_tentativas integer DEFAULT 0;
ALTER TABLE leads_gerados
  ADD COLUMN IF NOT EXISTS reengajamento_proxima timestamptz;

-- 3. Backfill de score baseado em dados existentes
UPDATE leads_gerados SET score =
  CASE WHEN google_rating >= 4.0 THEN 10 ELSE 0 END +
  CASE WHEN website IS NOT NULL AND website != '' THEN 5 ELSE 0 END
WHERE score = 0;

-- 4. Atualizar CHECK constraint de ai_status pra incluir descartado_definitivo
-- O constraint inline gerado pelo ADD COLUMN recebe nome automático do Postgres.
-- Dropamos pelo nome padrão e pelo possível nome alternativo.
ALTER TABLE leads_gerados DROP CONSTRAINT IF EXISTS leads_gerados_ai_status_check;
ALTER TABLE leads_gerados DROP CONSTRAINT IF EXISTS leads_gerados_ai_status_check1;

ALTER TABLE leads_gerados ADD CONSTRAINT leads_gerados_ai_status_check
  CHECK (ai_status IS NULL OR ai_status IN (
    'aguardando', 'em_ligacao', 'followup_wpp',
    'reuniao_agendada', 'sem_interesse', 'esgotado',
    'escalado_humano', 'descartado_definitivo'
  ));

-- 5. Atualizar CHECK constraint de motor_prospeccao_log.acao pra incluir reengajamento_wpp
ALTER TABLE motor_prospeccao_log DROP CONSTRAINT IF EXISTS motor_prospeccao_log_acao_check;

ALTER TABLE motor_prospeccao_log ADD CONSTRAINT motor_prospeccao_log_acao_check
  CHECK (acao IN (
    'wpp_primeiro_contato', 'wpp_resposta_ia',
    'ligacao_ia', 'ligacao_erro',
    'reuniao_agendada', 'sem_interesse',
    'escalado_humano', 'esgotado', 'erro',
    'reengajamento_wpp'
  ));

-- 6. Atualizar CHECK de modelo pra incluir voz_ia (já usado pelo worker)
ALTER TABLE motor_prospeccao_log DROP CONSTRAINT IF EXISTS motor_prospeccao_log_modelo_check;

ALTER TABLE motor_prospeccao_log ADD CONSTRAINT motor_prospeccao_log_modelo_check
  CHECK (modelo IS NULL OR modelo IN ('ligacao_wpp', 'wpp_direto', 'voz_ia'));

-- 7. Índice parcial para seleção de leads em reengajamento
CREATE INDEX IF NOT EXISTS idx_leads_reengajamento
  ON leads_gerados(organization_id, reengajamento_proxima)
  WHERE ai_status = 'esgotado' AND reengajamento_tentativas < 4;

-- 8. Índice para ordenação por score
CREATE INDEX IF NOT EXISTS idx_leads_score
  ON leads_gerados(organization_id, score DESC);
