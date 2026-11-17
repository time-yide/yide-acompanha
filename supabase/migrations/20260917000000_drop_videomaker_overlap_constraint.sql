-- Remove a exclusion constraint que impedia dois eventos no mesmo horário pro
-- mesmo videomaker. A checagem de conflito continua na aplicação (validateVideomakerAssignment),
-- mas agora o ADM pode clicar "Confirmar mesmo assim" pra sobrepor manualmente.
alter table public.calendar_events
  drop constraint if exists no_videomaker_overlap;
