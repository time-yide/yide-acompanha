-- Rules de notificação dos novos eventos de freela.

-- Quando alguém lança freela pendente: notifica gestão (adm, socio) pra aprovar.
insert into public.notification_rules (
  evento_tipo, ativo, mandatory, email_default,
  permite_destinatarios_extras, default_roles, default_user_ids
) values (
  'freela_pendente_aprovacao', true, false, false,
  true, ARRAY['adm', 'socio']::text[], ARRAY[]::uuid[]
) on conflict (evento_tipo) do nothing;

-- Quando gestão aprova: notifica quem lançou.
insert into public.notification_rules (
  evento_tipo, ativo, mandatory, email_default,
  permite_destinatarios_extras, default_roles, default_user_ids
) values (
  'freela_aprovada', true, false, false,
  true, ARRAY[]::text[], ARRAY[]::uuid[]
) on conflict (evento_tipo) do nothing;
