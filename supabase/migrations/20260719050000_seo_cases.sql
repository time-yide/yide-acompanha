-- Cases/portfólio: resultados reais de clientes (dados da Yide; IA só pole o texto).
create table if not exists public.seo_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null,
  cliente text not null,
  segmento text not null default '',
  localidade text not null default '',
  desafio text not null default '',
  solucao text not null default '',
  resultados jsonb not null default '[]',
  depoimento_texto text not null default '',
  depoimento_autor text not null default '',
  cover_image_url text,
  conteudo_md text not null default '',
  meta_title text,
  meta_description text,
  status text not null default 'rascunho' check (status in ('rascunho','publicado','arquivado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);
create index if not exists seo_cases_pub_idx on public.seo_cases (organization_id, status, updated_at desc);
alter table public.seo_cases enable row level security;
drop policy if exists "seo_cases_select_publicado" on public.seo_cases;
create policy "seo_cases_select_publicado" on public.seo_cases for select using (status = 'publicado');
