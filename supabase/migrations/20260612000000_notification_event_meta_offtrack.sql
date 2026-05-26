-- supabase/migrations/20260612000000_notification_event_meta_offtrack.sql
--
-- Adiciona evento `instagram_meta_offtrack` ao enum notification_event +
-- registra notification_rule default. Usado pelo cron diário que avisa o
-- assessor quando o cliente está fora do ritmo da meta mensal de posts.

alter type public.notification_event add value if not exists 'instagram_meta_offtrack';

-- Rule default: ativo, não-mandatório (assessor pode desabilitar nas
-- preferências), email desligado por padrão (in-app é suficiente),
-- direcionado pro role 'assessor'. A entrega real vai pro assessor do
-- cliente via user_ids_extras na chamada do dispatchNotification.
insert into public.notification_rules (
  evento_tipo, ativo, mandatory, email_default,
  permite_destinatarios_extras, default_roles, default_user_ids
) values (
  'instagram_meta_offtrack', true, false, false,
  true, ARRAY['assessor']::text[], ARRAY[]::uuid[]
) on conflict (evento_tipo) do nothing;
