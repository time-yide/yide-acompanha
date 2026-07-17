-- supabase/migrations/20260717120000_notification_rules_freela_reservada_seed.sql
-- Rule do evento freela_reservada: notificacao in-app pro proprio ator (via
-- user_ids_extras). Sem roles default, sem e-mail.
insert into public.notification_rules (
  evento_tipo, ativo, mandatory, email_default,
  permite_destinatarios_extras, default_roles, default_user_ids
) values (
  'freela_reservada', true, false, false,
  true, ARRAY[]::text[], ARRAY[]::uuid[]
) on conflict (evento_tipo) do nothing;
