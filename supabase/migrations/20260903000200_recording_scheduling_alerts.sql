create table recording_scheduling_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  client_id uuid not null references clients(id),
  calendar_id uuid not null references content_calendars(id),
  mes_gravacao text not null,
  status text not null default 'pendente'
    check (status in ('pendente', 'alinhado_cliente', 'agendado', 'concluido')),
  data_gravacao timestamptz,
  horario_inicio time,
  horario_fim time,
  local text,
  observacoes text,
  temas_gravar jsonb not null default '[]'::jsonb,
  calendar_event_id uuid references calendar_events(id),
  videomaker_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table recording_scheduling_alerts enable row level security;

create policy "rsa_select" on recording_scheduling_alerts
  for select to authenticated
  using (organization_id = (select organization_id from profiles where id = auth.uid()));

create policy "rsa_insert" on recording_scheduling_alerts
  for insert to authenticated
  with check (organization_id = (select organization_id from profiles where id = auth.uid()));

create policy "rsa_update" on recording_scheduling_alerts
  for update to authenticated
  using (organization_id = (select organization_id from profiles where id = auth.uid()));

create index idx_rsa_status on recording_scheduling_alerts(status);
create index idx_rsa_client on recording_scheduling_alerts(client_id);

-- IMPORTANTE: rodar os ALTER TYPE ADD VALUE em query separada ANTES deste bloco.
-- Ver migration 20260903000150_notification_event_gravacao_cronograma.sql

insert into public.notification_rules
  (evento_tipo, ativo, mandatory, email_default, permite_destinatarios_extras, default_roles, default_user_ids)
values
  ('gravacao_alinhada', true, false, false, true, array['audiovisual_chefe']::text[], array[]::uuid[]),
  ('gravacao_pendente_lembrete', true, false, false, true, array['audiovisual_chefe']::text[], array[]::uuid[])
on conflict do nothing;
