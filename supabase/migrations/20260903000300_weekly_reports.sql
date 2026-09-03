create table weekly_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  client_id uuid not null references clients(id),
  semana_inicio date not null,
  semana_fim date not null,
  dados jsonb not null default '{}'::jsonb,
  whatsapp_enviado boolean not null default false,
  whatsapp_enviado_em timestamptz,
  created_at timestamptz not null default now(),
  unique (client_id, semana_inicio)
);

alter table weekly_reports enable row level security;

create policy "wr_select" on weekly_reports
  for select to authenticated
  using (organization_id = (select organization_id from profiles where id = auth.uid()));

create policy "wr_insert" on weekly_reports
  for insert to authenticated
  with check (organization_id = (select organization_id from profiles where id = auth.uid()));

create index idx_wr_client_semana on weekly_reports(client_id, semana_inicio desc);
