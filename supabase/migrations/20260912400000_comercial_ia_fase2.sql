-- Comercial IA Fase 2 — cadência multi-canal + lembrete + índices

-- 1. Cadência multi-canal
CREATE TABLE IF NOT EXISTS public.cadencia_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES ai_voice_configs(id) ON DELETE CASCADE,
  ordem int NOT NULL,
  canal text NOT NULL CHECK (canal IN ('whatsapp', 'ligacao')),
  dias_apos_anterior int NOT NULL DEFAULT 2,
  template_tipo text NOT NULL DEFAULT 'auto'
    CHECK (template_tipo IN ('auto', 'primeiro_contato', 'followup', 'ultimo')),
  ativo boolean NOT NULL DEFAULT true,
  UNIQUE(config_id, ordem)
);

ALTER TABLE cadencia_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cadencia_steps_org_select" ON cadencia_steps
  FOR SELECT USING (
    config_id IN (
      SELECT id FROM ai_voice_configs
      WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "cadencia_steps_service_all" ON cadencia_steps
  FOR ALL USING (true) WITH CHECK (true);

-- 2. Lembrete de reunião IA
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS lembrete_ia_enviado boolean DEFAULT false;

-- 3. Índice pra dashboard
CREATE INDEX IF NOT EXISTS motor_log_acao_criado_idx
  ON motor_prospeccao_log(organization_id, acao, criado_em DESC);

-- 4. Índice pra buscar conversas com IA ativa
CREATE INDEX IF NOT EXISTS wpp_conv_ai_ativa_idx
  ON wpp_conversations(organization_id, ai_ativa)
  WHERE ai_ativa = true;
