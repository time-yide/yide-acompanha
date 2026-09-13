-- Pesquisas automáticas: o sistema gera leads todo dia sem intervenção humana.
-- O admin cadastra nicho + cidade, e o cron diário busca leads novos via Outscraper.

CREATE TABLE pesquisas_automaticas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nicho text NOT NULL,
  cidade text NOT NULL,
  quantidade int NOT NULL DEFAULT 20 CHECK (quantidade >= 1 AND quantidade <= 500),
  ativo boolean NOT NULL DEFAULT true,
  ultima_execucao timestamptz,
  total_leads_gerados int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pesquisas_auto_org ON pesquisas_automaticas(organization_id);

ALTER TABLE pesquisas_automaticas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros da org veem pesquisas auto" ON pesquisas_automaticas
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );
