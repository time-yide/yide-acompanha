-- Colunas de config da campanha automática na ai_voice_configs
ALTER TABLE ai_voice_configs
  ADD COLUMN IF NOT EXISTS auto_campanha_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_campanha_meta_atendidas integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS auto_campanha_max_tentativas integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS auto_campanha_horario_inicio time NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS auto_campanha_horario_fim time NOT NULL DEFAULT '18:00';

-- Tracking diário
CREATE TABLE IF NOT EXISTS campanha_discagem_diaria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  data date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'em_andamento',
  colaborador_id uuid REFERENCES profiles(id),
  tentativas integer NOT NULL DEFAULT 0,
  atendidas integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now(),
  finalizada_em timestamptz,
  UNIQUE (organization_id, data)
);

ALTER TABLE campanha_discagem_diaria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full" ON campanha_discagem_diaria
  FOR ALL USING (true) WITH CHECK (true);
