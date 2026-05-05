-- supabase/migrations/20260505000045_notification_event_calendar_participant.sql
-- Notifica usuário quando ele é adicionado como participante de um evento
-- do calendário interno. Disparada por:
-- - createEventAction: notifica todos os participantes da nova reunião
-- - updateEventAction: notifica APENAS os participantes recém-adicionados
--   (não re-notifica quem já estava)

alter type public.notification_event add value if not exists 'evento_calendario_marcado';

-- Default rule: ativo, opcional (não mandatório), sem e-mail por padrão.
-- Quem é destinatário: apenas os participantes do evento (passados como
-- user_ids_extras do dispatch). Sem default_roles ou default_user_ids
-- porque o destinatário é específico ao evento.
insert into public.notification_rules (
  evento_tipo,
  ativo,
  mandatory,
  email_default,
  permite_destinatarios_extras,
  default_roles,
  default_user_ids
) values (
  'evento_calendario_marcado',
  true,
  false,
  false,
  true,
  array[]::text[],
  array[]::uuid[]
)
on conflict (evento_tipo) do nothing;
