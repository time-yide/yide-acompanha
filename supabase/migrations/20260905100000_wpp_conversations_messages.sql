-- Tabelas para conversas WhatsApp via Twilio
-- Conversas = thread por contato (telefone), Mensagens = cada msg individual

CREATE TABLE IF NOT EXISTS wpp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  contato_nome text NOT NULL DEFAULT '',
  contato_telefone text NOT NULL,
  canal text NOT NULL DEFAULT 'whatsapp' CHECK (canal IN ('whatsapp')),
  lead_gerado_id uuid REFERENCES leads_gerados(id) ON DELETE SET NULL,
  ultimo_texto text,
  ultima_msg_em timestamptz,
  nao_lidas int NOT NULL DEFAULT 0,
  arquivada boolean NOT NULL DEFAULT false,
  fixada boolean NOT NULL DEFAULT false,
  twilio_from text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, contato_telefone)
);

CREATE TABLE IF NOT EXISTS wpp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES wpp_conversations(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  autor text NOT NULL CHECK (autor IN ('lead', 'comercial', 'sistema')),
  texto text NOT NULL DEFAULT '',
  media_url text,
  media_type text,
  twilio_sid text,
  status text NOT NULL DEFAULT 'enviada' CHECK (status IN ('enviando', 'enviada', 'entregue', 'lida', 'falhou')),
  enviado_por uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wpp_conversations_org
  ON wpp_conversations (organization_id);
CREATE INDEX IF NOT EXISTS idx_wpp_conversations_telefone
  ON wpp_conversations (organization_id, contato_telefone);
CREATE INDEX IF NOT EXISTS idx_wpp_messages_conversation
  ON wpp_messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_wpp_messages_twilio_sid
  ON wpp_messages (twilio_sid) WHERE twilio_sid IS NOT NULL;

ALTER TABLE wpp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wpp_conversations_select" ON wpp_conversations
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "wpp_messages_select" ON wpp_messages
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );
