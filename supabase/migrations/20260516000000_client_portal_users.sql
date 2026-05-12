-- Painel do cliente — fase 1
-- Tabela que linka auth.users → clients pra clientes finais acessarem
-- o portal externo. Mantém auth COMPARTILHADA (mesma auth.users) mas
-- identidade isolada: cada auth.user é OU colaborador (`profiles`) OU
-- cliente portal (`client_portal_users`), nunca os dois ao mesmo tempo.

create table public.client_portal_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  nome_contato text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create index idx_client_portal_users_client_id on public.client_portal_users(client_id);
create index idx_client_portal_users_ativo on public.client_portal_users(ativo) where ativo;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.client_portal_users enable row level security;

-- Cliente portal lê apenas a própria linha
create policy "self_read_portal_user" on public.client_portal_users
  for select using (user_id = auth.uid());

-- Service-role bypassa tudo (não precisa policy explícita); usado por
-- server actions internas (criação, reset, revoke).

-- ─── Permitir cliente portal ler o próprio cliente ────────────────────────────
-- Cliente portal user logado consegue selecionar a linha em `clients` que
-- está linkada via `client_portal_users.client_id`. Equipe interna continua
-- acessando via service-role (já é o padrão atual — RLS antiga continua).

create policy "client_portal_reads_own_client" on public.clients
  for select using (
    id in (
      select client_id
      from public.client_portal_users
      where user_id = auth.uid() and ativo = true
    )
  );

-- Comentário pra documentar
comment on table public.client_portal_users is
  'Vincula auth.users a clients pra acesso externo de cliente final ao painel /cliente. '
  'Cada auth.user é OU colaborador (profiles) OU cliente portal — nunca ambos.';
