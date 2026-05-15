-- Snapshots históricos do GMB de cada cliente — append-only, 1 linha por
-- refresh (manual ou cron). Usado pra plotar evolução de nota/reviews no
-- painel interno /painel-gmb.
--
-- Dedupe: unique index em (client_id, captured_on::date) impede inserir
-- duas linhas no mesmo dia (cron + refresh manual = 1 snapshot/dia/cliente).
-- Quando UPSERT no mesmo dia, sobrescreve a hora pra refletir update mais
-- recente daquele dia.

create table public.client_gmb_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  rating numeric(2,1) check (rating is null or (rating >= 0 and rating <= 5)),
  review_count integer check (review_count is null or review_count >= 0),
  captured_at timestamptz not null default now(),
  /** Origem do snapshot — útil pra debug. */
  source text not null default 'manual' check (source in ('manual', 'cron', 'refresh_button'))
);

create index idx_client_gmb_snapshots_client on public.client_gmb_snapshots(client_id, captured_at desc);

-- Dedupe: 1 snapshot por dia por cliente. Cron + refresh manual no mesmo
-- dia → faz UPSERT atualizando os valores e o captured_at.
create unique index uq_client_gmb_snapshots_client_day
  on public.client_gmb_snapshots(client_id, ((captured_at at time zone 'America/Cuiaba')::date));

alter table public.client_gmb_snapshots enable row level security;

-- SELECT: equipe interna (não precisa de cliente portal aqui — esse é dashboard interno)
create policy "client_gmb_snapshots select"
  on public.client_gmb_snapshots for select to authenticated
  using (
    public.current_user_role() in (
      'adm', 'socio', 'coordenador', 'assessor', 'audiovisual_chefe'
    )
  );

-- INSERT/UPDATE: service role (cron + actions). Nenhum policy pra users
-- diretos — só backend insere.

comment on table public.client_gmb_snapshots is
  'Histórico de nota/reviews do GMB de cada cliente. Append-only com '
  'dedupe diário. Plotado no /painel-gmb pra ver evolução.';
