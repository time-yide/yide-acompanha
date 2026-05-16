-- Fase 1 do módulo Produtividade: tracking de atividade DENTRO do sistema.
-- Sem app desktop (Fase 3). Sem captura de mouse/teclado/screenshots.
-- Apenas: heartbeat do browser (quem tá online) + log de eventos
-- significativos no app (criou tarefa, mudou status, etc).
--
-- Custo/hora é DERIVADO automaticamente de profiles.fixo_mensal +
-- média de commission_snapshots.valor_total dos últimos 3 meses,
-- dividido por 176h (22 dias × 8h). Não tem campo custo_hora aqui.

-- ─── 1) Heartbeat — quem tá online ─────────────────────────────────────────
-- Adiciona em profiles dois timestamps. last_seen_at é atualizado a cada
-- heartbeat do browser (~30s). last_active_event_at é atualizado quando o
-- usuário FAZ uma ação registrada (não só ficou com a aba aberta).

alter table public.profiles
  add column last_seen_at timestamptz,
  add column last_active_event_at timestamptz;

create index idx_profiles_last_seen on public.profiles(last_seen_at desc nulls last)
  where last_seen_at is not null;

comment on column public.profiles.last_seen_at is
  'Último heartbeat recebido do browser. "Online" = menos de 2 min atrás. '
  'Aba aberta conta, mesmo sem ação.';
comment on column public.profiles.last_active_event_at is
  'Último evento ATIVO registrado (criou tarefa, mudou status, etc). '
  '"Ativo" = teve ação nos últimos 5 min, não só aba aberta.';

-- ─── 2) Eventos de atividade ───────────────────────────────────────────────
-- Append-only. Cada ação significativa no sistema gera 1 linha. Usado pra:
-- - calcular tempo ativo (sessões de eventos contíguos)
-- - ranking (quantos eventos por colab)
-- - timeline diária
-- - relatórios por cliente/projeto

create type public.activity_event_type as enum (
  'login',              -- logou no sistema
  'heartbeat',          -- ping de browser (NÃO registra aqui — só atualiza profiles.last_seen_at)
  'tarefa_criada',
  'tarefa_status_alterado',
  'tarefa_concluida',
  'tarefa_alteracao',
  'cliente_criado',
  'cliente_editado',
  'reuniao_criada',
  'reuniao_concluida',
  'ligacao_registrada',
  'lead_criado',
  'lead_movido',
  'apresentacao_criada',
  'comentario',
  'arte_criada',
  'arte_aprovada',
  'captura_criada',
  'captura_concluida',
  'post_criado',
  'post_aprovado',
  'solicitacao_respondida',
  'pageview',           -- abriu uma rota (heatmap de navegação) — opcional
  'outro'
);

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type public.activity_event_type not null,
  /** Tabela relacionada (clients, tasks, meetings, etc). Null = não atrelado. */
  entity_type text,
  /** ID do registro relacionado. Null se entity_type for null. */
  entity_id uuid,
  /** Cliente associado, pra agregação custo/projeto-cliente. Nullable: nem
      toda ação é por cliente (ex: editar próprio perfil). */
  client_id uuid references public.clients(id) on delete set null,
  /** Dados extras, livres. Ex: { from_status: 'aberta', to_status: 'concluida' } */
  metadata jsonb not null default '{}'::jsonb,
  /** Data local do evento — usado pra agregação por dia em Cuiabá-time. */
  event_date date not null default ((now() at time zone 'America/Cuiaba')::date),
  created_at timestamptz not null default now()
);

create index idx_activity_events_user_date on public.activity_events(user_id, event_date desc);
create index idx_activity_events_user_created on public.activity_events(user_id, created_at desc);
create index idx_activity_events_client on public.activity_events(client_id) where client_id is not null;
create index idx_activity_events_type_created on public.activity_events(event_type, created_at desc);

-- ─── RLS ──────────────────────────────────────────────────────────────────
alter table public.activity_events enable row level security;

-- SELECT: adm/sócio veem tudo (dashboard de produtividade).
-- Coord/audiovisual_chefe veem da própria equipe (TODO Fase 2 — por enquanto vêem tudo também).
-- Demais users SÓ os próprios eventos (timeline pessoal).
create policy "activity_events select"
  on public.activity_events for select to authenticated
  using (
    public.current_user_role() in ('adm', 'socio', 'coordenador', 'audiovisual_chefe')
    or user_id = auth.uid()
  );

-- INSERT: service role apenas (API endpoint registra com service role pra
-- não depender de RLS — user_id vem da sessão validada).
-- Nenhum policy de insert pra authenticated.

-- Sem UPDATE/DELETE — append-only.

comment on table public.activity_events is
  'Log append-only de atividades significativas no sistema. Base do '
  'dashboard /produtividade. Fase 1: registrado via API a partir de actions '
  'do app. Fase 3 (futura): app desktop alimenta eventos do SO.';
