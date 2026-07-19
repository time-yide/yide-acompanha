-- "Assuntos em alta": ranking diário de temas quentes (das fontes que o robô monitora),
-- pra guiar a criação de conteúdo do blog. Recalculado 1x/dia (cron) ou sob demanda.
create table if not exists public.blog_trending (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  posicao int not null,
  tema text not null,
  motivo text not null default '',
  angulo text not null default '',
  fontes int not null default 0,
  atualizado_em timestamptz not null default now()
);

create index if not exists blog_trending_org_idx
  on public.blog_trending (organization_id, posicao);

-- RLS ligada sem policies = nega tudo. Leitura/escrita só via service-role no servidor.
alter table public.blog_trending enable row level security;
