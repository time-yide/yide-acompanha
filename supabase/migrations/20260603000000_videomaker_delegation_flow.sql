-- Fluxo de delegação de captação pelo Coord Audiovisual.
--
-- Decisão produto (Yasmin):
-- 1. Assessor cria evento de videomaker → cai na FILA do coord audiovisual
--    (status='pending_delegation', sem videomaker_assigned_id)
-- 2. Coord audiovisual escolhe qual videomaker faz aquela captação
--    (delegação → status='scheduled', videomaker_assigned_id setado)
-- 3. Só DEPOIS da delegação, o evento aparece na agenda do videomaker
-- 4. Colisão de horário: bloqueada APENAS pro mesmo videomaker
--    (videomakers diferentes podem gravar simultâneamente — agência tem 4+)
--
-- A delegação de EDIÇÃO continua separada (ver
-- delegateCapturaAction em src/lib/audiovisual/actions.ts), que rola
-- depois da captação concluída.

-- ─── 1) Status enum ────────────────────────────────────────────────────────
create type public.videomaker_event_status as enum (
  'pending_delegation',  -- assessor criou, esperando coord delegar
  'scheduled',           -- coord delegou pra videomaker X, na agenda dele
  'completed',           -- captação realizada (videomaker entregou)
  'cancelled'            -- cancelada pelo assessor/coord
);

-- ─── 2) Colunas em calendar_events ─────────────────────────────────────────
alter table public.calendar_events
  add column videomaker_status public.videomaker_event_status,
  add column videomaker_assigned_id uuid references public.profiles(id) on delete set null,
  add column videomaker_delegado_por uuid references public.profiles(id) on delete set null,
  add column videomaker_delegado_em timestamptz;

comment on column public.calendar_events.videomaker_status is
  'Estado da delegação (só pra eventos sub_calendar=videomakers). Pending = '
  'na fila do coord; Scheduled = delegado e na agenda do videomaker.';
comment on column public.calendar_events.videomaker_assigned_id is
  'Videomaker designado pelo coord. NULL enquanto pending_delegation.';

-- ─── 3) Backfill: eventos antigos viram "scheduled" (legacy) ───────────────
-- Não tentamos inferir videomaker_assigned_id a partir de participantes_ids
-- — coord pode revisar manualmente depois.
update public.calendar_events
  set videomaker_status = 'scheduled'
  where sub_calendar::text = 'videomakers' and videomaker_status is null;

-- ─── 4) Constraint: status obrigatório pra eventos de videomaker ───────────
alter table public.calendar_events
  add constraint chk_videomaker_status_required
  check (
    sub_calendar::text <> 'videomakers'
    or videomaker_status is not null
  );

-- ─── 5) Exclusion constraint — sem overlap pro mesmo videomaker ────────────
-- btree_gist permite usar = no UUID + && (overlap) no range no mesmo
-- EXCLUDE. Sem isso, só funcionaria pra um único operador.
create extension if not exists btree_gist;

alter table public.calendar_events
  add constraint no_videomaker_overlap
  exclude using gist (
    videomaker_assigned_id with =,
    tstzrange(inicio, fim, '[)') with &&
  )
  where (
    sub_calendar::text = 'videomakers'
    and videomaker_status = 'scheduled'
    and videomaker_assigned_id is not null
  );

comment on constraint no_videomaker_overlap on public.calendar_events is
  'Bloqueia o mesmo videomaker de ter 2 captações agendadas com horário sobreposto. '
  'Só aplica em status=scheduled (pending não conta).';

-- ─── 6) Index pra performance da página de coordenação ────────────────────
create index idx_calendar_events_videomaker_pending
  on public.calendar_events(inicio)
  where sub_calendar::text = 'videomakers' and videomaker_status = 'pending_delegation';

create index idx_calendar_events_videomaker_assigned
  on public.calendar_events(videomaker_assigned_id, inicio)
  where sub_calendar::text = 'videomakers' and videomaker_assigned_id is not null;
