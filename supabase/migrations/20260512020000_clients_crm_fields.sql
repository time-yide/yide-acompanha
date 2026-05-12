-- =====================================================
-- CRM por cliente — FASE 1
-- Cada cliente pode ter um CRM cadastrado (Yide, RD, HubSpot, etc.).
-- Fase 2 (futuro) vai integrar deep link com CRM Yide via tenant_id.
-- =====================================================

alter table public.clients
  add column if not exists crm_tipo text
    check (crm_tipo in (
      'yide',          -- CRM Yide (meu-novo-sistema, multi-tenant)
      'rd_station',
      'hubspot',
      'pipedrive',
      'ploomes',
      'kommo',
      'agendor',
      'salesforce',
      'zoho',
      'bitrix',
      'custom',        -- Outro CRM (URL livre)
      'planilha',      -- Cliente usa planilha (sem CRM)
      'nenhum'         -- Cliente não tem CRM
    ));

alter table public.clients
  add column if not exists crm_url text;            -- Link direto pra abrir o CRM
alter table public.clients
  add column if not exists crm_identifier text;     -- ID/slug do cliente no CRM (ex: tenant_id Yide, conta RD)
alter table public.clients
  add column if not exists crm_observacoes text;    -- Observações livres (login, contato comercial, etc.)
