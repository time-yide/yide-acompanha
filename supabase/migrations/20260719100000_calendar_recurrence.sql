-- supabase/migrations/20260719100000_calendar_recurrence.sql
-- Recorrência de eventos: ocorrências materializadas ligadas por series_id.
-- A 1ª ocorrência (mestre) guarda a regra em recurrence_rule pra permitir
-- estender séries "forever" via cron. Eventos únicos ficam com tudo NULL.

alter table public.calendar_events
  add column if not exists series_id uuid,
  add column if not exists recurrence_rule jsonb,
  add column if not exists recurrence_end_kind text
    check (recurrence_end_kind in ('date', 'count', 'forever'));

create index if not exists idx_calendar_events_series
  on public.calendar_events(series_id)
  where series_id is not null;

-- Índice pro cron achar séries "forever" e o fim de cada uma.
create index if not exists idx_calendar_events_forever_master
  on public.calendar_events(series_id)
  where recurrence_end_kind = 'forever';

-- Idempotência por construção: impede ocorrência duplicada (mesmo series_id +
-- inicio) num re-trigger/retry do cron de extensão. Parcial pra não afetar
-- eventos únicos (series_id null).
create unique index if not exists uq_calendar_events_series_inicio
  on public.calendar_events(series_id, inicio)
  where series_id is not null;
