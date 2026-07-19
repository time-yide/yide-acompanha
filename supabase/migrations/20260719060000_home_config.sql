-- Conteúdo editável da home institucional (1 linha por org).
create table if not exists public.home_config (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  dados jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique (organization_id)
);
alter table public.home_config enable row level security;
-- Leitura/escrita via service-role (sem policy = nega direto ao cliente).
