-- supabase/migrations/20260429000024_recados_notification_rules_seed.sql

insert into public.notification_rules
  (evento_tipo, ativo, mandatory, email_default, permite_destinatarios_extras, default_roles, default_user_ids)
values
  ('recado_novo', true, false, false, true, array[]::text[], array[]::uuid[])
on conflict do nothing;
