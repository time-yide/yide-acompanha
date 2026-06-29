-- Métricas dos posts (Fase 1). Snapshot do valor mais recente por (post, rede, métrica).
create table if not exists public.social_media_metricas (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_media_posts(id) on delete cascade,
  rede text not null,                 -- 'instagram' | 'facebook'
  metrica text not null,              -- 'alcance' | 'curtidas' | 'comentarios' | 'salvamentos' | 'compartilhamentos' | 'engajamento'
  valor bigint not null default 0,
  coletado_em timestamptz not null default now(),
  unique (post_id, rede, metrica)
);

create index if not exists social_metricas_post_idx
  on public.social_media_metricas(post_id);

alter table public.social_media_metricas enable row level security;

drop policy if exists social_metricas_select on public.social_media_metricas;
create policy social_metricas_select on public.social_media_metricas
  for select to authenticated using (true);

drop policy if exists social_metricas_insert on public.social_media_metricas;
create policy social_metricas_insert on public.social_media_metricas
  for insert to authenticated with check (true);

drop policy if exists social_metricas_update on public.social_media_metricas;
create policy social_metricas_update on public.social_media_metricas
  for update to authenticated using (true);
