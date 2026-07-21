-- Módulo Pesquisas — parte 2/2: tabelas, RLS e regra de notificação.
-- Requer a migration 20260721000000 (enum notification_event) aplicada antes.

-- Enums próprios do módulo (create type + uso na mesma tx é ok).
create type public.pesquisa_status as enum ('rascunho', 'aberta', 'encerrada');
create type public.pesquisa_pergunta_tipo as enum ('multipla_escolha', 'escala', 'sim_nao', 'texto');

-- Pesquisa (formulário)
create table public.pesquisas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  titulo text not null,
  descricao text,
  anonima boolean not null default false,
  status public.pesquisa_status not null default 'rascunho',
  criado_por uuid references public.profiles(id),
  disparada_em timestamptz,
  prazo timestamptz,
  encerrada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index pesquisas_status_idx on public.pesquisas(status) where deleted_at is null;
create index pesquisas_criado_por_idx on public.pesquisas(criado_por);

-- Perguntas
create table public.pesquisa_perguntas (
  id uuid primary key default gen_random_uuid(),
  pesquisa_id uuid not null references public.pesquisas(id) on delete cascade,
  ordem int not null,
  tipo public.pesquisa_pergunta_tipo not null,
  enunciado text not null,
  opcoes jsonb,
  escala_min int,
  escala_max int,
  obrigatoria boolean not null default true
);
create index pesquisa_perguntas_pesquisa_idx on public.pesquisa_perguntas(pesquisa_id);

-- Destinatários (quem foi alvo + se respondeu)
create table public.pesquisa_destinatarios (
  id uuid primary key default gen_random_uuid(),
  pesquisa_id uuid not null references public.pesquisas(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  respondeu_em timestamptz,
  unique (pesquisa_id, user_id)
);
create index pesquisa_destinatarios_user_idx on public.pesquisa_destinatarios(user_id);

-- Respostas (user_id null quando anônima)
create table public.pesquisa_respostas (
  id uuid primary key default gen_random_uuid(),
  pesquisa_id uuid not null references public.pesquisas(id) on delete cascade,
  pergunta_id uuid not null references public.pesquisa_perguntas(id) on delete cascade,
  user_id uuid references public.profiles(id),
  valor jsonb not null,
  created_at timestamptz not null default now()
);
create index pesquisa_respostas_pesquisa_idx on public.pesquisa_respostas(pesquisa_id);
create index pesquisa_respostas_pergunta_idx on public.pesquisa_respostas(pergunta_id);

-- RLS: leitura permissiva pra authenticated (as queries do módulo rodam via
-- service-role dentro do unstable_cache; escrita de gestão também via service-role
-- com checagem no código). Espelha o padrão dos demais recursos internos.
alter table public.pesquisas enable row level security;
alter table public.pesquisa_perguntas enable row level security;
alter table public.pesquisa_destinatarios enable row level security;
alter table public.pesquisa_respostas enable row level security;

create policy pesquisas_read on public.pesquisas for select to authenticated using (true);
create policy perguntas_read on public.pesquisa_perguntas for select to authenticated using (true);
create policy destinatarios_read on public.pesquisa_destinatarios for select to authenticated using (true);
create policy respostas_read on public.pesquisa_respostas for select to authenticated using (true);

-- O próprio destinatário insere respostas (anônima grava user_id null).
create policy respostas_insert on public.pesquisa_respostas for insert to authenticated
  with check (auth.uid() = user_id or user_id is null);

-- Regra de notificação: disparo manda pro time via user_ids_extras.
insert into public.notification_rules
  (evento_tipo, ativo, mandatory, email_default, permite_destinatarios_extras, default_roles, default_user_ids)
values
  ('pesquisa_disparada', true, true, false, true, '{}', '{}')
on conflict (evento_tipo) do nothing;
