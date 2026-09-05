-- Adiciona coluna base_prospeccao para segmentar leads em 3 bases de prospecção:
-- ecommerce (venda de produto/marketplace), crm (serviços → Lyide), marketing (geral)
ALTER TABLE leads_gerados
  ADD COLUMN IF NOT EXISTS base_prospeccao text
    CHECK (base_prospeccao IN ('ecommerce', 'crm', 'marketing'));

CREATE INDEX IF NOT EXISTS idx_leads_gerados_base_prospeccao
  ON leads_gerados (base_prospeccao)
  WHERE base_prospeccao IS NOT NULL;
