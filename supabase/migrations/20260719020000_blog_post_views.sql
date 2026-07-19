-- Métricas do blog: registra cada visita às páginas públicas de post.
-- Só métrica interna — NÃO guarda IP nem qualquer dado pessoal, só post + hora.
create table if not exists public.blog_post_views (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists blog_post_views_post_idx
  on public.blog_post_views (post_id);
create index if not exists blog_post_views_org_created_idx
  on public.blog_post_views (organization_id, created_at desc);

-- RLS ligada sem policies = nega tudo por padrão.
-- Leitura (dashboard) e escrita (registro de visita) acontecem só via service-role no servidor.
alter table public.blog_post_views enable row level security;
