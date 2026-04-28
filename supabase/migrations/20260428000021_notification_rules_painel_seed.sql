-- supabase/migrations/20260428000021_notification_rules_painel_seed.sql

insert into public.notification_rules
  (evento_tipo, ativo, mandatory, email_default, permite_destinatarios_extras, default_roles)
values
  ('checklist_step_delegada',  true, false, false, true, array['socio', 'adm', 'coordenador', 'assessor', 'designer', 'videomaker', 'editor', 'audiovisual_chefe']),
  ('checklist_step_atrasada',  true, false, true,  true, array['socio', 'adm', 'coordenador', 'assessor']),
  ('checklist_step_concluida', true, false, false, true, array['socio', 'adm', 'coordenador', 'assessor', 'designer', 'videomaker', 'editor', 'audiovisual_chefe'])
on conflict do nothing;
