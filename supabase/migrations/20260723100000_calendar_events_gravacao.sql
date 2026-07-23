-- supabase/migrations/20260723100000_calendar_events_gravacao.sql
--
-- "Reunião obrigatória + trava pra gravar": liga o evento da agenda ao módulo
-- Reuniões. Aplicação MANUAL no SQL Editor. (meetings já existe.)

alter table public.calendar_events
  add column if not exists requer_gravacao boolean not null default false,
  add column if not exists gravacao_status text not null default 'pendente',
  add column if not exists gravacao_meeting_id uuid references public.meetings(id) on delete set null,
  add column if not exists gravacao_motivo text,
  add column if not exists gravacao_justificativa text,
  add column if not exists gravacao_resolvido_em timestamptz,
  add column if not exists lembrete_gravar_criacao_em timestamptz,
  add column if not exists lembrete_gravar_10min_em timestamptz,
  add column if not exists lembrete_gravar_inicio_em timestamptz;

create index if not exists idx_calendar_events_gravacao_pendente
  on public.calendar_events (criado_por, inicio)
  where requer_gravacao and gravacao_status = 'pendente';
