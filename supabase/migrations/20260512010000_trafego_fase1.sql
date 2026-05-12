-- =====================================================
-- TRÁFEGO — FASE 1
-- Tabelas pra cadastrar campanhas (manual + futuro Meta/Google API)
-- =====================================================

-- 1) Campanhas
create table if not exists public.trafego_campanhas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,

  plataforma text not null check (plataforma in ('meta','google')),
  nome text not null,
  objetivo text,                   -- ex: trafego, conversoes, alcance, mensagens, leads
  status text not null default 'rascunho'
    check (status in ('rascunho','ativa','pausada','finalizada','rejeitada')),

  -- IDs externos (preenchidos quando integrar com Meta/Google API)
  external_account_id text,        -- Ad Account ID na BM/Google
  external_campaign_id text,       -- Campaign ID na plataforma
  external_adset_id text,          -- Conjunto de anúncios (Meta) / Ad Group (Google)
  external_ad_id text,             -- Ad ID

  budget_diario numeric(12,2),     -- R$
  budget_total numeric(12,2),      -- R$

  link_destino text,
  copy text,
  publico_alvo text,
  criativo_url text,               -- URL do criativo (imagem/vídeo)

  data_inicio date,
  data_fim date,

  observacoes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists trafego_campanhas_client_idx
  on public.trafego_campanhas(client_id) where archived_at is null;
create index if not exists trafego_campanhas_status_idx
  on public.trafego_campanhas(status) where archived_at is null;
create index if not exists trafego_campanhas_org_idx
  on public.trafego_campanhas(organization_id);

-- updated_at trigger (segue padrão dos outros)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trafego_campanhas_set_updated_at on public.trafego_campanhas;
create trigger trafego_campanhas_set_updated_at
  before update on public.trafego_campanhas
  for each row execute function public.set_updated_at();

alter table public.trafego_campanhas enable row level security;

-- Policy permissiva (auth check no app, mesmo padrão de outras tabelas)
drop policy if exists trafego_campanhas_select on public.trafego_campanhas;
create policy trafego_campanhas_select on public.trafego_campanhas
  for select to authenticated using (true);

drop policy if exists trafego_campanhas_insert on public.trafego_campanhas;
create policy trafego_campanhas_insert on public.trafego_campanhas
  for insert to authenticated with check (true);

drop policy if exists trafego_campanhas_update on public.trafego_campanhas;
create policy trafego_campanhas_update on public.trafego_campanhas
  for update to authenticated using (true);

-- DELETE só service-role (igual outras tabelas críticas)
-- Sem policy = bloqueado pra authenticated.

-- =====================================================
-- 2) Métricas diárias por campanha
-- =====================================================
-- Guarda 1 linha por (campanha, data, métrica). Schema flexível pra acomodar
-- TODAS as métricas que Meta/Google retornam — não precisa migration nova
-- pra cada nova métrica que aparecer.
create table if not exists public.trafego_metricas_diarias (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.trafego_campanhas(id) on delete cascade,
  data date not null,
  metrica_key text not null,       -- ex: spend, impressions, clicks, ctr, cpc, conversions, ...
  valor_numerico numeric(20,6),    -- pra valores numéricos
  valor_texto text,                -- pra valores textuais (ex: nome de algo)
  fonte text not null default 'manual'
    check (fonte in ('manual','meta','google')),
  created_at timestamptz not null default now(),
  unique (campanha_id, data, metrica_key)
);

create index if not exists trafego_metricas_campanha_data_idx
  on public.trafego_metricas_diarias(campanha_id, data desc);
create index if not exists trafego_metricas_key_idx
  on public.trafego_metricas_diarias(metrica_key);

alter table public.trafego_metricas_diarias enable row level security;

drop policy if exists trafego_metricas_select on public.trafego_metricas_diarias;
create policy trafego_metricas_select on public.trafego_metricas_diarias
  for select to authenticated using (true);

drop policy if exists trafego_metricas_insert on public.trafego_metricas_diarias;
create policy trafego_metricas_insert on public.trafego_metricas_diarias
  for insert to authenticated with check (true);

drop policy if exists trafego_metricas_update on public.trafego_metricas_diarias;
create policy trafego_metricas_update on public.trafego_metricas_diarias
  for update to authenticated using (true);

-- =====================================================
-- 3) Preferência de métricas visíveis por usuário
-- =====================================================
-- Cada usuário escolhe quais métricas ver na UI. Default: nenhuma — UI
-- mostra um modal pra escolher na primeira vez.
alter table public.profiles
  add column if not exists trafego_metricas_visiveis text[] default '{}';

-- =====================================================
-- 4) Mapping cliente → conta de anúncios
-- =====================================================
-- Pra Fase 2 (sync Meta/Google): cada cliente pode ter 1 ad_account no Meta
-- e 1 no Google. Adiciona já agora pra UI cadastrar; sync vem na Fase 2.
alter table public.clients
  add column if not exists meta_ad_account_id text;
alter table public.clients
  add column if not exists google_ads_customer_id text;
