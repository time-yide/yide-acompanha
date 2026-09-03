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

insert into notification_rules (evento_tipo, titulo, ativo, default_roles, permite_email)
values
  ('gravacao_alinhada', 'Gravacao alinhada pelo assessor', true, '{audiovisual_chefe}', false),
  ('gravacao_pendente_lembrete', 'Lembrete de gravacao pendente', true, '{audiovisual_chefe}', false)
on conflict do nothing;
