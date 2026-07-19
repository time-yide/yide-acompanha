-- Blog interno da Yide: posts gerenciados no sistema, páginas públicas pra SEO.
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null,
  titulo text not null,
  resumo text,
  conteudo_md text not null default '',
  cover_image_url text,
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'arquivado')),
  meta_title text,
  meta_description text,
  keywords text[] not null default '{}',
  -- Fonte (pro pipeline automático: conteúdo traduzido/adaptado de fonte internacional).
  fonte_url text,
  fonte_nome text,
  autor_id uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create index if not exists blog_posts_status_idx
  on public.blog_posts (organization_id, status, published_at desc);

alter table public.blog_posts enable row level security;

-- Leitura pública só dos publicados. Escrita é feita via server actions.
drop policy if exists "blog_posts_select_publicado" on public.blog_posts;
create policy "blog_posts_select_publicado" on public.blog_posts
  for select using (status = 'publicado');
