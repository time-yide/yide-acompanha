-- supabase/migrations/20260710000100_stories.sql
-- Stories por cliente: flag + quantidade diária no cliente, e contagem mensal
-- numa tabela isolada (não mexe no checklist de feed).

alter table public.clients
  add column if not exists tem_stories boolean not null default false,
  add column if not exists quantidade_diaria_stories integer not null default 0;

create table if not exists public.client_monthly_stories (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  mes_referencia text not null,
  quantidade_postada integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, mes_referencia)
);
create index idx_client_monthly_stories_mes on public.client_monthly_stories(mes_referencia);
create index idx_client_monthly_stories_client on public.client_monthly_stories(client_id);

create trigger trg_client_monthly_stories_updated_at
  before update on public.client_monthly_stories
  for each row execute function public.set_updated_at();

alter table public.client_monthly_stories enable row level security;

create policy "client_monthly_stories select" on public.client_monthly_stories
  for select to authenticated using (
    public.current_user_role() in ('adm','socio','coordenador','assessor','audiovisual_chefe','fast_midia')
  );
create policy "client_monthly_stories insert" on public.client_monthly_stories
  for insert to authenticated with check (
    public.current_user_role() in ('adm','socio','coordenador','fast_midia')
  );
create policy "client_monthly_stories update" on public.client_monthly_stories
  for update to authenticated using (
    public.current_user_role() in ('adm','socio','coordenador','fast_midia')
  ) with check (
    public.current_user_role() in ('adm','socio','coordenador','fast_midia')
  );
