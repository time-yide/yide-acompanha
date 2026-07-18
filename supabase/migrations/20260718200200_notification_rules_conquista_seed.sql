-- Regra da notificação de conquista desbloqueada.
-- Entregue via user_ids_extras (a própria pessoa que desbloqueou); sem roles padrão.
-- Rode DEPOIS de 20260718200100 (o valor do enum precisa já existir e estar commitado).
insert into public.notification_rules
  (evento_tipo, ativo, mandatory, email_default, permite_destinatarios_extras, default_roles, default_user_ids)
values
  ('conquista_desbloqueada', true, false, false, true, array[]::text[], array[]::uuid[])
on conflict (evento_tipo) do nothing;
