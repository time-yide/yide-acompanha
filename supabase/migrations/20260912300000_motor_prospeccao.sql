-- Motor de Prospecção — Fase 1
-- Estende ai_voice_configs com campos do motor, adiciona ai_ativa em wpp_conversations,
-- adiciona modelo_prospeccao em pesquisas, cria tabela de log.

-- 1. Colunas novas em ai_voice_configs (config do motor)
ALTER TABLE public.ai_voice_configs
  ADD COLUMN IF NOT EXISTS wpp_system_prompt text,
  ADD COLUMN IF NOT EXISTS wpp_primeiro_contato_prompt text,
  ADD COLUMN IF NOT EXISTS motor_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_chamadas_dia int NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS max_wpp_dia int NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS horario_inicio time NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS horario_fim time NOT NULL DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS horario_inicio_fds time NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS horario_fim_fds time NOT NULL DEFAULT '17:00',
  ADD COLUMN IF NOT EXISTS twilio_wpp_from text;

-- 2. ai_ativa em wpp_conversations (marca conversas gerenciadas pela IA)
ALTER TABLE public.wpp_conversations
  ADD COLUMN IF NOT EXISTS ai_ativa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_config_id uuid REFERENCES ai_voice_configs(id);

-- 3. modelo_prospeccao em pesquisas (override por pesquisa)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads_gerados_pesquisas'
      AND column_name = 'modelo_prospeccao'
  ) THEN
    ALTER TABLE public.leads_gerados_pesquisas
      ADD COLUMN modelo_prospeccao text DEFAULT 'auto'
        CHECK (modelo_prospeccao IN ('auto', 'ligacao_wpp', 'wpp_direto', 'pausado'));
  END IF;
END $$;

-- 4. Tabela de log do motor
CREATE TABLE IF NOT EXISTS public.motor_prospeccao_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  lead_gerado_id  uuid NOT NULL REFERENCES leads_gerados(id),
  acao            text NOT NULL CHECK (acao IN (
    'wpp_primeiro_contato', 'wpp_resposta_ia',
    'ligacao_ia', 'reuniao_agendada', 'sem_interesse',
    'escalado_humano', 'esgotado', 'erro'
  )),
  modelo          text CHECK (modelo IN ('ligacao_wpp', 'wpp_direto')),
  detalhes        jsonb,
  criado_em       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS motor_log_org_idx
  ON motor_prospeccao_log(organization_id);
CREATE INDEX IF NOT EXISTS motor_log_lead_idx
  ON motor_prospeccao_log(lead_gerado_id);
CREATE INDEX IF NOT EXISTS motor_log_criado_idx
  ON motor_prospeccao_log(criado_em DESC);

-- RLS para motor_prospeccao_log
ALTER TABLE public.motor_prospeccao_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "motor_log_select_by_org" ON public.motor_prospeccao_log
  FOR SELECT USING (organization_id = public.get_user_org());

CREATE POLICY "motor_log_insert_service" ON public.motor_prospeccao_log
  FOR INSERT WITH CHECK (true);

-- 5. Índice para seleção de leads pelo motor
CREATE INDEX IF NOT EXISTS leads_gerados_motor_sel_idx
  ON leads_gerados(organization_id, status, ai_status, ai_tentativas, arquivado_em)
  WHERE arquivado_em IS NULL;
