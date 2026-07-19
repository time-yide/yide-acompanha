-- Blog estratégico (GEO/EEAT): FAQ estruturada + tipo do post (noticia/estrategico).
alter table public.blog_posts
  add column if not exists faq jsonb not null default '[]',
  add column if not exists tipo text not null default 'noticia';

-- Constraint do tipo (idempotente).
do $$ begin
  alter table public.blog_posts add constraint blog_posts_tipo_check check (tipo in ('noticia','estrategico'));
exception when duplicate_object then null; end $$;

create index if not exists blog_posts_tipo_idx on public.blog_posts (organization_id, tipo, status);
