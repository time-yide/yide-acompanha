-- Campos fiscais necessários para emissão de NFS-e via ABRASF
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS razao_social text,
  ADD COLUMN IF NOT EXISTS inscricao_municipal text,
  ADD COLUMN IF NOT EXISTS codigo_servico text DEFAULT '1.04',
  ADD COLUMN IF NOT EXISTS regime_tributario smallint DEFAULT 1,
  ADD COLUMN IF NOT EXISTS aliquota_iss numeric(5,2) DEFAULT 5.00;

-- Tabela de notas fiscais emitidas
CREATE TABLE IF NOT EXISTS public.nfse_emitidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  mes_referencia text NOT NULL,
  numero_nfse text,
  codigo_verificacao text,
  valor_servico numeric(12,2) NOT NULL,
  valor_iss numeric(12,2),
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'emitida', 'cancelada', 'erro')),
  xml_envio text,
  xml_retorno text,
  erro_msg text,
  emitida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, client_id, mes_referencia)
);

ALTER TABLE public.nfse_emitidas ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_nfse_emitidas_client_mes
  ON public.nfse_emitidas (client_id, mes_referencia DESC);

CREATE TRIGGER set_updated_at_nfse_emitidas
  BEFORE UPDATE ON public.nfse_emitidas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
