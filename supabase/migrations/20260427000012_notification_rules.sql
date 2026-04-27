-- supabase/migrations/20260427000012_notification_rules.sql
-- Enum dos 16 tipos de eventos notificáveis + tabela de regras editadas por Sócio/ADM.

create type public.notification_event as enum (
  'task_assigned',
  'task_completed',
  'kanban_moved',
  'prospeccao_agendada',
  'deal_fechado',
  'mes_aguardando_aprovacao',
  'mes_aprovado',
  'cliente_perto_churn',
  'task_prazo_amanha',
  'task_overdue',
  'evento_calendario_hoje',
  'marco_zero_24h',
  'aniversario_socio_cliente',
  'aniversario_colaborador',
  'renovacao_contrato',
  'satisfacao_pendente'
);

create table public.notification_rules (
  evento_tipo public.notification_event primary key,
  ativo boolean not null default true,
  mandatory boolean not null default false,
  email_default boolean not null default false,
  permite_destinatarios_extras boolean not null default true,
  default_roles text[] not null default array[]::text[],
  default_user_ids uuid[] not null default array[]::uuid[],
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.notification_rules enable row level security;

create policy "anyone authenticated reads rules"
  on public.notification_rules for select to authenticated using (true);

create policy "manage:users role updates rules"
  on public.notification_rules for update to authenticated
  using (public.current_user_role() in ('adm', 'socio'))
  with check (public.current_user_role() in ('adm', 'socio'));

-- Seed inicial das 16 regras
insert into public.notification_rules
  (evento_tipo, ativo, mandatory, email_default, permite_destinatarios_extras, default_roles)
values
  ('task_assigned',             true, false, false, true,  array[]::text[]),
  ('task_completed',            true, false, false, true,  array[]::text[]),
  ('kanban_moved',              true, false, true,  true,  array['adm']),
  ('prospeccao_agendada',       true, false, false, true,  array['adm']),
  ('deal_fechado',              true, false, true,  false, array['adm','socio']),
  ('mes_aguardando_aprovacao',  true, true,  true,  false, array['socio']),
  ('mes_aprovado',              true, true,  true,  false, array[]::text[]),
  ('cliente_perto_churn',       true, false, true,  true,  array['socio']),
  ('task_prazo_amanha',         true, false, false, true,  array[]::text[]),
  ('task_overdue',              true, false, true,  true,  array[]::text[]),
  ('evento_calendario_hoje',    true, false, false, true,  array[]::text[]),
  ('marco_zero_24h',            true, false, true,  true,  array[]::text[]),
  ('aniversario_socio_cliente', true, false, false, true,  array['coordenador','assessor']),
  ('aniversario_colaborador',   true, false, false, true,  array['adm','socio','comercial','coordenador','assessor','videomaker','designer','editor','audiovisual_chefe']),
  ('renovacao_contrato',        true, false, true,  true,  array[]::text[]),
  ('satisfacao_pendente',       true, false, false, false, array['coordenador','assessor']);
