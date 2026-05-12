-- =====================================================
-- GERADOR DE LEADS — FASE 1
-- Tabelas pra busca + enriquecimento + qualificação de leads B2B
-- a partir de Google Maps (Outscraper) + futuras integrações
-- (Apollo, Hunter, Instagram, IA scoring nas Fases 2/3).
-- =====================================================

-- 1) Pesquisas — cada vez que o usuário busca por nicho+cidade
create table if not exists public.leads_gerados_pesquisas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  criado_por uuid references public.profiles(id) on delete set null,

  nicho text not null,
  cidade text not null,
  query text generated always as (nicho || ' em ' || cidade) stored,
  -- Provedor que processou esta pesquisa
  fonte text not null default 'outscraper'
    check (fonte in ('outscraper','apify','manual')),
  -- Limite de resultados solicitado (Outscraper aceita até 500)
  limite int not null default 20 check (limite between 1 and 500),

  status text not null default 'pendente'
    check (status in ('pendente','processando','concluido','erro')),
  total_resultados int not null default 0,
  total_novos int not null default 0,        -- Quantos eram leads inéditos (não duplicaram)
  erro_mensagem text,

  -- Outscraper retorna um request_id assíncrono pra polling
  external_request_id text,

  created_at timestamptz not null default now(),
  iniciado_em timestamptz,
  concluido_em timestamptz
);

create index if not exists leads_gerados_pesquisas_org_idx
  on public.leads_gerados_pesquisas(organization_id, created_at desc);
create index if not exists leads_gerados_pesquisas_status_idx
  on public.leads_gerados_pesquisas(status)
  where status in ('pendente','processando');

alter table public.leads_gerados_pesquisas enable row level security;

drop policy if exists leads_gerados_pesquisas_select on public.leads_gerados_pesquisas;
create policy leads_gerados_pesquisas_select on public.leads_gerados_pesquisas
  for select to authenticated using (true);

drop policy if exists leads_gerados_pesquisas_insert on public.leads_gerados_pesquisas;
create policy leads_gerados_pesquisas_insert on public.leads_gerados_pesquisas
  for insert to authenticated with check (true);

drop policy if exists leads_gerados_pesquisas_update on public.leads_gerados_pesquisas;
create policy leads_gerados_pesquisas_update on public.leads_gerados_pesquisas
  for update to authenticated using (true);

-- =====================================================
-- 2) Leads gerados — cada empresa encontrada
-- Schema completo já preparado pras Fases 2/3 (decisor, IA, etc.)
-- =====================================================
create table if not exists public.leads_gerados (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  pesquisa_id uuid references public.leads_gerados_pesquisas(id) on delete set null,

  -- ===== Dados da empresa (Outscraper / Google Maps) =====
  empresa text not null,
  telefone text,
  whatsapp text,
  email text,
  website text,
  dominio text,                  -- Extraído do website pra reusar em Hunter/Apollo
  instagram text,                -- @ ou URL completa
  endereco text,
  cidade text,
  estado text,
  pais text default 'BR',
  categoria text,
  horario_funcionamento text,    -- texto livre ("Seg-Sex 8h-18h")
  google_rating numeric(3,1),
  google_reviews_count int,
  google_place_id text,          -- Pra evitar duplicatas (mesmo lugar pode aparecer em buscas diferentes)
  google_maps_url text,
  latitude numeric(10,7),
  longitude numeric(10,7),

  -- ===== Decisor (preenchido na Fase 2 via Apollo/Hunter) =====
  decisor_nome text,
  decisor_cargo text,
  decisor_email text,
  decisor_telefone text,
  decisor_linkedin text,
  outros_decisores jsonb default '[]'::jsonb,
  -- [{nome, cargo, email, linkedin}]

  -- ===== Instagram (Fase 3) =====
  instagram_seguidores int,
  instagram_seguindo int,
  instagram_posts int,
  instagram_bio text,
  instagram_ativo boolean,
  instagram_metadata jsonb default '{}'::jsonb,

  -- ===== IA scoring (Fase 3) =====
  score int check (score is null or score between 0 and 100),
  qualificado boolean,
  observacoes_ia text,
  potencial_comercial text check (potencial_comercial is null or potencial_comercial in ('alto','medio','baixo')),
  diagnostico jsonb default '{}'::jsonb,
  -- Estrutura sugerida:
  -- {
  --   sem_site: bool,
  --   sem_trafego: bool,
  --   site_desatualizado: bool,
  --   marketing_fraco: bool,
  --   instagram_inativo: bool,
  --   sem_resposta_avaliacoes: bool,
  --   pontos_fortes: [...],
  --   pontos_fracos: [...]
  -- }

  -- ===== Status da equipe comercial =====
  status text not null default 'novo'
    check (status in ('novo','em_contato','qualificado','reuniao_marcada','proposta_enviada','cliente','descartado')),
  tags text[] not null default '{}',
  observacoes text,
  responsavel_id uuid references public.profiles(id) on delete set null,
  -- Quando vira cliente real, vincula ao lead do onboarding
  lead_onboarding_id uuid references public.leads(id) on delete set null,

  -- ===== Origem & metadata =====
  fonte text not null default 'outscraper'
    check (fonte in ('outscraper','apify','manual')),
  raw_data jsonb,                -- Resposta crua da API (debug + futuras extrações)

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  arquivado_em timestamptz,

  -- Evita duplicatas: mesmo place_id na mesma org só entra 1x
  unique nulls not distinct (organization_id, google_place_id)
);

create index if not exists leads_gerados_org_idx
  on public.leads_gerados(organization_id, created_at desc)
  where arquivado_em is null;
create index if not exists leads_gerados_status_idx
  on public.leads_gerados(status)
  where arquivado_em is null;
create index if not exists leads_gerados_pesquisa_idx
  on public.leads_gerados(pesquisa_id);
create index if not exists leads_gerados_responsavel_idx
  on public.leads_gerados(responsavel_id)
  where arquivado_em is null;
create index if not exists leads_gerados_score_idx
  on public.leads_gerados(score desc nulls last)
  where arquivado_em is null;
-- Busca por nome (LIKE)
create index if not exists leads_gerados_empresa_trgm_idx
  on public.leads_gerados using gin (empresa gin_trgm_ops);
-- Filtro por tags (text[])
create index if not exists leads_gerados_tags_idx
  on public.leads_gerados using gin (tags);

-- updated_at trigger (set_updated_at já existe das outras migrations)
drop trigger if exists leads_gerados_set_updated_at on public.leads_gerados;
create trigger leads_gerados_set_updated_at
  before update on public.leads_gerados
  for each row execute function public.set_updated_at();

alter table public.leads_gerados enable row level security;

drop policy if exists leads_gerados_select on public.leads_gerados;
create policy leads_gerados_select on public.leads_gerados
  for select to authenticated using (true);

drop policy if exists leads_gerados_insert on public.leads_gerados;
create policy leads_gerados_insert on public.leads_gerados
  for insert to authenticated with check (true);

drop policy if exists leads_gerados_update on public.leads_gerados;
create policy leads_gerados_update on public.leads_gerados
  for update to authenticated using (true);

-- =====================================================
-- 3) Extensão pg_trgm pra busca por similaridade
-- =====================================================
create extension if not exists pg_trgm;
