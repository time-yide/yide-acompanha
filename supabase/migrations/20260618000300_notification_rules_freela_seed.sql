-- supabase/migrations/20260618000300_notification_rules_freela_seed.sql
-- Rule default do evento freela_nova_oportunidade: notifica assessores,
-- videomakers e o coordenador audiovisual (audiovisual_chefe). Configurável
-- depois em Configurações -> Notificações (admin pode incluir editores etc).
insert into public.notification_rules (
  evento_tipo, ativo, mandatory, email_default,
  permite_destinatarios_extras, default_roles, default_user_ids
) values (
  'freela_nova_oportunidade', true, false, false,
  true, ARRAY['assessor', 'videomaker', 'audiovisual_chefe']::text[], ARRAY[]::uuid[]
) on conflict (evento_tipo) do nothing;
