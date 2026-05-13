-- Tráfego Fase 2 — sync com Meta Ads
-- Adiciona colunas pra trackear última sincronização por campanha + por cliente.

-- Em campanhas: quando foi a última vez que essa campanha sincronizou
-- métricas com Meta. NULL = nunca sincronizada (ou cadastro manual).
alter table public.trafego_campanhas
  add column if not exists meta_synced_at timestamptz;

-- Em clientes: timestamp do último sync bem-sucedido pra esse cliente.
-- Usado pra mostrar "Última sync: hoje 04:00" na UI.
alter table public.clients
  add column if not exists meta_last_sync_at timestamptz;

-- Erro do último sync (se houve). Limpado quando sync seguinte for bem-sucedido.
-- Tipos comuns: "ad_account_not_found", "token_invalid", "rate_limit",
-- "no_meta_account_id", "api_error".
alter table public.clients
  add column if not exists meta_last_sync_error text;

create index if not exists idx_clients_has_meta_account
  on public.clients(meta_ad_account_id) where meta_ad_account_id is not null;

comment on column public.trafego_campanhas.meta_synced_at is
  'Última vez que essa campanha teve métricas sincronizadas via Meta API. '
  'NULL = nunca sincronizada (ou cadastrada manualmente sem sync).';

comment on column public.clients.meta_last_sync_at is
  'Timestamp do último sync com Meta (bem-sucedido). Usado pra mostrar '
  '"Última sync" na UI de tráfego.';
