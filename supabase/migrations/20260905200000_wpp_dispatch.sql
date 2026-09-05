-- Templates de mensagem WhatsApp por base de prospecção
CREATE TABLE IF NOT EXISTS wpp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nome text NOT NULL,
  base_prospeccao text CHECK (base_prospeccao IN ('ecommerce', 'crm', 'marketing')),
  corpo text NOT NULL,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Fila de disparo WhatsApp
CREATE TABLE IF NOT EXISTS wpp_dispatch_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_gerado_id uuid NOT NULL REFERENCES leads_gerados(id) ON DELETE CASCADE,
  template_id uuid REFERENCES wpp_templates(id) ON DELETE SET NULL,
  telefone_destino text NOT NULL,
  mensagem_renderizada text NOT NULL,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'enviando', 'enviado', 'falhou', 'cancelado')),
  erro_msg text,
  tentativas int NOT NULL DEFAULT 0,
  agendado_para timestamptz NOT NULL DEFAULT now(),
  enviado_em timestamptz,
  conversation_id uuid REFERENCES wpp_conversations(id) ON DELETE SET NULL,
  twilio_from text NOT NULL,
  criado_por uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wpp_templates_org ON wpp_templates(organization_id);
CREATE INDEX idx_wpp_dispatch_org_status ON wpp_dispatch_queue(organization_id, status);
CREATE INDEX idx_wpp_dispatch_pendente ON wpp_dispatch_queue(status, agendado_para)
  WHERE status = 'pendente';
CREATE INDEX idx_wpp_dispatch_lead ON wpp_dispatch_queue(lead_gerado_id);

ALTER TABLE wpp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpp_dispatch_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wpp_templates_select" ON wpp_templates
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "wpp_dispatch_queue_select" ON wpp_dispatch_queue
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );
