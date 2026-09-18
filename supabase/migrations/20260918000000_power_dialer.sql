-- Power Dialer: tabelas e colunas

-- 1. Novos campos em ai_voice_configs
ALTER TABLE ai_voice_configs
  ADD COLUMN IF NOT EXISTS power_dialer_ativo boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS power_dialer_batch_size integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS power_dialer_timeout_s integer DEFAULT 15,
  ADD COLUMN IF NOT EXISTS power_dialer_colaborador_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS power_dialer_greeting text DEFAULT 'Olá, tudo bem? Só um momento...',
  ADD COLUMN IF NOT EXISTS power_dialer_goodbye text DEFAULT 'Desculpe, vamos retornar em breve, obrigada!';

-- 2. Flag de prioridade em leads_gerados
ALTER TABLE leads_gerados
  ADD COLUMN IF NOT EXISTS dropado_power_dialer boolean DEFAULT false;

-- 3. Tabela de batches
CREATE TABLE IF NOT EXISTS power_dialer_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  conference_name text NOT NULL,
  status text NOT NULL DEFAULT 'discando'
    CHECK (status IN ('discando','conectado','timeout','concluido','erro')),
  lead_atendeu_id uuid REFERENCES leads_gerados(id),
  colaborador_id uuid NOT NULL REFERENCES public.profiles(id),
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  conectado_em timestamptz,
  finalizado_em timestamptz,
  duracao_segundos integer,
  gravacao_url text,
  gravacao_sid text,
  resumo_ia text,
  transcricao jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pd_batches_org_status
  ON power_dialer_batches(organization_id, status);

-- 4. Tabela de calls individuais do batch
CREATE TABLE IF NOT EXISTS power_dialer_batch_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES power_dialer_batches(id) ON DELETE CASCADE,
  lead_gerado_id uuid NOT NULL REFERENCES leads_gerados(id),
  twilio_call_sid text,
  status text NOT NULL DEFAULT 'discando'
    CHECK (status IN ('discando','atendeu','dropado','nao_atendeu','ocupado','erro')),
  atendeu_em timestamptz,
  finalizado_em timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pd_batch_calls_batch
  ON power_dialer_batch_calls(batch_id);
CREATE INDEX IF NOT EXISTS idx_pd_batch_calls_sid
  ON power_dialer_batch_calls(twilio_call_sid);

-- 5. RLS
ALTER TABLE power_dialer_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE power_dialer_batch_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_pd_batches" ON power_dialer_batches
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_pd_batch_calls" ON power_dialer_batch_calls
  FOR ALL USING (true) WITH CHECK (true);

-- 6. Push subscriptions: reaproveita a tabela public.push_subscriptions já
-- existente (migration 20260508000065_push_subscriptions.sql), keyed por
-- user_id -> profiles(id) — mesma convenção de colaborador_id em todo o
-- resto do schema. Não precisa de tabela/coluna nova aqui.
