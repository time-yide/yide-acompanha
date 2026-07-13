-- Controle de stories POR DIA (aba FastMedia). Cada linha = um cliente marcado
-- como "postou stories" num dia específico. `quantidade` guarda quantos stories
-- foram postados naquele dia (snapshot da diária do cliente no momento da marca,
-- editável). O contador mensal existente (client_monthly_stories.quantidade_postada)
-- é mantido em sincronia pelo server action (soma das quantidades do mês), pra o
-- /painel continuar funcionando sem mudança.

create table if not exists public.client_story_posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  data date not null,
  quantidade integer not null default 1,
  marcado_por uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, data)
);
create index if not exists idx_client_story_posts_client on public.client_story_posts(client_id);
create index if not exists idx_client_story_posts_data on public.client_story_posts(data);

create trigger trg_client_story_posts_updated_at
  before update on public.client_story_posts
  for each row execute function public.set_updated_at();

alter table public.client_story_posts enable row level security;

-- Leitura: mesma régua da client_monthly_stories (gestão + fast_midia + assessor).
create policy "client_story_posts select" on public.client_story_posts
  for select to authenticated using (
    public.current_user_role() in ('adm','socio','coordenador','assessor','audiovisual_chefe','fast_midia')
  );

-- Escrita: quem marca stories (fast_midia + gestão que coordena).
create policy "client_story_posts insert" on public.client_story_posts
  for insert to authenticated with check (
    public.current_user_role() in ('adm','socio','coordenador','fast_midia')
  );
create policy "client_story_posts update" on public.client_story_posts
  for update to authenticated using (
    public.current_user_role() in ('adm','socio','coordenador','fast_midia')
  ) with check (
    public.current_user_role() in ('adm','socio','coordenador','fast_midia')
  );
create policy "client_story_posts delete" on public.client_story_posts
  for delete to authenticated using (
    public.current_user_role() in ('adm','socio','coordenador','fast_midia')
  );
