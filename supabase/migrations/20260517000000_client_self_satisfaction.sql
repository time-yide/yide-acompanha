-- Painel do cliente — Fase 2: avaliação do próprio cliente
-- Cliente final pode submeter a nota dele sobre a Yide (0-10) + comentário.
-- Equipe vê isso lado a lado com a percepção interna (satisfaction_synthesis).

create table public.client_self_satisfaction (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  submitted_by uuid not null references auth.users(id),
  score smallint not null check (score >= 0 and score <= 10),
  comentario text,
  submitted_at timestamptz not null default now()
);

create index idx_client_self_satisfaction_client_id_submitted_at
  on public.client_self_satisfaction(client_id, submitted_at desc);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.client_self_satisfaction enable row level security;

-- Cliente portal pode ler suas próprias submissions
create policy "client_portal_reads_own_self_satisfaction" on public.client_self_satisfaction
  for select using (
    client_id in (
      select client_id
      from public.client_portal_users
      where user_id = auth.uid() and ativo = true
    )
  );

-- Cliente portal pode inserir submission pra próprio client
create policy "client_portal_inserts_own_self_satisfaction" on public.client_self_satisfaction
  for insert with check (
    submitted_by = auth.uid()
    and client_id in (
      select client_id
      from public.client_portal_users
      where user_id = auth.uid() and ativo = true
    )
  );

-- Service-role (equipe interna) bypassa RLS, lê tudo.

comment on table public.client_self_satisfaction is
  'Avaliação que o cliente final faz da Yide via portal /cliente. '
  'Equipe interna vê esses dados pra comparar com a percepção própria '
  '(satisfaction_synthesis).';
