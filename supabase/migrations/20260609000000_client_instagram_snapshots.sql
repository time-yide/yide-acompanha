-- supabase/migrations/20260609000000_client_instagram_snapshots.sql
--
-- Snapshots periódicos do perfil do Instagram do cliente via scraping
-- Apify. As contagens hoje/semana/mês são derivadas em runtime filtrando
-- recent_posts por timestamp.

create table public.client_instagram_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),

  scraped_at timestamptz not null default now(),

  -- Total de posts no perfil (vem direto do Apify). Null se scrape falhou.
  total_posts int,

  -- Lista de até ~50 posts recentes: [{ url, timestamp, type: 'feed'|'reel' }].
  -- Vazio se conta privada / scrape falhou.
  recent_posts jsonb not null default '[]'::jsonb,

  scrape_status text not null
    check (scrape_status in ('ok', 'profile_not_found', 'rate_limit', 'error', 'no_url')),

  erro text,

  -- 'cron' | userId (UUID do colaborador que disparou manual)
  triggered_by text not null,

  created_at timestamptz default now()
);

create index idx_client_instagram_snapshots_client_recent
  on public.client_instagram_snapshots (client_id, scraped_at desc);

-- RLS
alter table public.client_instagram_snapshots enable row level security;

-- SELECT: equipe interna (cliente do portal NÃO lê — snapshot é interno).
create policy "ig_snapshots select equipe"
  on public.client_instagram_snapshots for select to authenticated
  using (
    public.current_user_role() in ('socio', 'adm', 'coordenador', 'assessor', 'comercial')
  );

-- INSERT/UPDATE/DELETE: bloqueado pra todos. Server actions e cron usam
-- service-role que bypassa RLS.
create policy "ig_snapshots write service only"
  on public.client_instagram_snapshots for all to authenticated
  using (false) with check (false);

comment on table public.client_instagram_snapshots is
  'Snapshots periódicos do perfil do Instagram do cliente via scraping Apify. '
  'Usado pra contagem de posts no dashboard. Só preenchido pra pacotes '
  'yide_360/estrategia/trafego_estrategia.';
