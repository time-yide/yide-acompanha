-- Edição urgente: vídeo que precisa sair antes do prazo padrão (3 dias úteis
-- desde a gravação). Marcado pelo assessor no agendamento (calendar_events) e
-- confirmado/alterado pelo videomaker na captação (audiovisual_capturas).
-- APLICAR MANUALMENTE no SQL Editor do Supabase.

alter table public.calendar_events
  add column if not exists edicao_urgente boolean,
  add column if not exists edicao_urgente_data date,
  add column if not exists edicao_urgente_qtd int;

alter table public.calendar_events
  drop constraint if exists chk_calendar_edicao_urgente;
alter table public.calendar_events
  add constraint chk_calendar_edicao_urgente check (
    edicao_urgente is not true
    or (edicao_urgente_data is not null and edicao_urgente_qtd >= 1)
  );

alter table public.audiovisual_capturas
  add column if not exists edicao_urgente boolean,
  add column if not exists edicao_urgente_data date,
  add column if not exists edicao_urgente_qtd int,
  add column if not exists task_urgente_id uuid references public.tasks(id) on delete set null;

alter table public.audiovisual_capturas
  drop constraint if exists chk_captura_edicao_urgente;
alter table public.audiovisual_capturas
  add constraint chk_captura_edicao_urgente check (
    edicao_urgente is not true
    or (edicao_urgente_data is not null and edicao_urgente_qtd >= 1)
  );

notify pgrst, 'reload schema';
