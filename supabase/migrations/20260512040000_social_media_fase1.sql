-- =====================================================
-- SOCIAL MEDIA — FASE 1
-- Cadastro + agendamento de posts (sem publicar ainda — Fase 2 publica via Meta API)
-- =====================================================

-- 1) Mapeamento cliente → contas de rede social
-- (mesmo padrão de meta_ad_account_id / google_ads_customer_id do Tráfego)
alter table public.clients
  add column if not exists instagram_business_id text;
alter table public.clients
  add column if not exists facebook_page_id text;
alter table public.clients
  add column if not exists linkedin_company_id text;
alter table public.clients
  add column if not exists gmn_location_id text;

-- 2) Posts (estilo mLabs)
create table if not exists public.social_media_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,

  titulo text,                       -- nome interno do post (opcional)
  legenda text,                      -- texto principal do post
  primeiro_comentario text,          -- comentário automático após publicar
  hashtags text,

  -- Mídias: array de URLs (suporta carrossel)
  midias jsonb not null default '[]'::jsonb,

  formato text not null default 'feed'
    check (formato in ('feed','story','reels','carrossel')),

  -- Redes onde vai publicar (multi-select)
  redes text[] not null default '{}',  -- {'instagram','facebook','linkedin','gmn'}

  -- Quando publicar (UTC)
  agendar_para timestamptz,

  -- Status do post como um todo
  status text not null default 'rascunho'
    check (status in (
      'rascunho',              -- sendo editado
      'aguardando_aprovacao',  -- enviado pra cliente revisar (Fase 3)
      'aprovado',              -- cliente aprovou
      'ajustes_solicitados',   -- cliente pediu ajuste
      'agendado',              -- pronto pra publicar no horário
      'publicado',             -- foi ao ar
      'falha'                  -- erro ao publicar
    )),

  -- Vínculo com Design (Fase 4 da Design vai usar isso)
  design_arte_id uuid references public.design_artes(id) on delete set null,

  -- Aprovação (Fase 3 — link público sem login)
  aprovacao_token uuid unique default gen_random_uuid(),
  aprovado_em timestamptz,
  aprovado_por_email text,
  ajuste_observacoes text,

  observacoes text,
  criado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists social_posts_client_idx
  on public.social_media_posts(client_id) where archived_at is null;
create index if not exists social_posts_status_idx
  on public.social_media_posts(status) where archived_at is null;
create index if not exists social_posts_agendar_idx
  on public.social_media_posts(agendar_para) where archived_at is null and status = 'agendado';
create index if not exists social_posts_org_idx
  on public.social_media_posts(organization_id);

-- updated_at trigger
drop trigger if exists social_media_posts_set_updated_at on public.social_media_posts;
create trigger social_media_posts_set_updated_at
  before update on public.social_media_posts
  for each row execute function public.set_updated_at();

alter table public.social_media_posts enable row level security;

drop policy if exists social_posts_select on public.social_media_posts;
create policy social_posts_select on public.social_media_posts
  for select to authenticated using (true);

drop policy if exists social_posts_insert on public.social_media_posts;
create policy social_posts_insert on public.social_media_posts
  for insert to authenticated with check (true);

drop policy if exists social_posts_update on public.social_media_posts;
create policy social_posts_update on public.social_media_posts
  for update to authenticated using (true);

-- =====================================================
-- 3) Publicações (uma por rede pra cada post)
-- Pra Fase 2: o cron publica e cria 1 linha por rede onde foi ao ar.
-- Stats também ficam vinculadas a publicação.
-- =====================================================
create table if not exists public.social_media_publicacoes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_media_posts(id) on delete cascade,
  rede text not null check (rede in ('instagram','facebook','linkedin','gmn')),
  external_id text,                  -- ID retornado pela API da rede
  external_url text,                 -- URL pública do post
  publicado_em timestamptz,
  erro text,                         -- mensagem de erro se falhou
  created_at timestamptz not null default now(),
  unique (post_id, rede)
);

create index if not exists social_pub_post_idx
  on public.social_media_publicacoes(post_id);

alter table public.social_media_publicacoes enable row level security;

drop policy if exists social_pub_select on public.social_media_publicacoes;
create policy social_pub_select on public.social_media_publicacoes
  for select to authenticated using (true);

drop policy if exists social_pub_insert on public.social_media_publicacoes;
create policy social_pub_insert on public.social_media_publicacoes
  for insert to authenticated with check (true);

drop policy if exists social_pub_update on public.social_media_publicacoes;
create policy social_pub_update on public.social_media_publicacoes
  for update to authenticated using (true);

-- =====================================================
-- 4) Storage bucket pra criativos do social media
-- =====================================================
insert into storage.buckets (id, name, public)
  values ('social-media-creatives', 'social-media-creatives', false)
  on conflict (id) do nothing;

drop policy if exists "social-media-creatives read authenticated" on storage.objects;
create policy "social-media-creatives read authenticated" on storage.objects
  for select to authenticated
  using (bucket_id = 'social-media-creatives');

drop policy if exists "social-media-creatives insert authenticated" on storage.objects;
create policy "social-media-creatives insert authenticated" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'social-media-creatives');

drop policy if exists "social-media-creatives update authenticated" on storage.objects;
create policy "social-media-creatives update authenticated" on storage.objects
  for update to authenticated
  using (bucket_id = 'social-media-creatives');

drop policy if exists "social-media-creatives delete authenticated" on storage.objects;
create policy "social-media-creatives delete authenticated" on storage.objects
  for delete to authenticated
  using (bucket_id = 'social-media-creatives');
