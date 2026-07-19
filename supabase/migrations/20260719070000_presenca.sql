-- Presença da Yide: posts gerados (GMN/LinkedIn) + estado do checklist por perfil.
create table if not exists public.presenca_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  canal text not null check (canal in ('gmn','linkedin')),
  tema text not null default '',
  conteudo text not null,
  hashtags text[] not null default '{}',
  status text not null default 'rascunho' check (status in ('rascunho','usado','arquivado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists presenca_posts_idx on public.presenca_posts (organization_id, canal, created_at desc);

create table if not exists public.presenca_checklist (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  canal text not null check (canal in ('gmn','linkedin')),
  feitos jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  unique (organization_id, canal)
);

alter table public.presenca_posts enable row level security;
alter table public.presenca_checklist enable row level security;
-- Sem policy: acesso só via service-role (painel interno).
