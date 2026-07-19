-- SEO local: páginas serviço × localidade (cidade/estado), geradas por IA e aprovadas.
create table if not exists public.seo_services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nome text not null,
  slug text not null,
  descricao_base text not null default '',
  ordem int not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.seo_localidades (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('cidade','estado')),
  uf text not null default '',
  slug text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.seo_paginas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  service_id uuid not null references public.seo_services(id) on delete cascade,
  localidade_id uuid not null references public.seo_localidades(id) on delete cascade,
  slug text not null,
  titulo text not null default '',
  meta_title text,
  meta_description text,
  conteudo_md text not null default '',
  faq jsonb not null default '[]',
  status text not null default 'rascunho' check (status in ('rascunho','publicado','arquivado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, service_id, localidade_id)
);

create index if not exists seo_paginas_pub_idx on public.seo_paginas (organization_id, status);
create index if not exists seo_paginas_slug_idx on public.seo_paginas (organization_id, slug);

alter table public.seo_services enable row level security;
alter table public.seo_localidades enable row level security;
alter table public.seo_paginas enable row level security;

drop policy if exists "seo_paginas_select_publicado" on public.seo_paginas;
create policy "seo_paginas_select_publicado" on public.seo_paginas
  for select using (status = 'publicado');
