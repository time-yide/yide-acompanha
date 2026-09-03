create table content_calendars (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  client_id uuid not null references clients(id),
  mes_referencia text not null,
  modo text not null check (modo in ('completo', 'leve')),
  status text not null default 'pendente_geracao'
    check (status in ('pendente_geracao', 'gerando', 'gerado', 'aprovado', 'erro')),
  posts_json jsonb not null default '[]'::jsonb,
  pesquisa_tendencias jsonb,
  task_id uuid references tasks(id),
  aprovado_por uuid references profiles(id),
  aprovado_em timestamptz,
  erro_msg text,
  tentativas int not null default 0,
  criado_por uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, mes_referencia)
);

alter table content_calendars enable row level security;

create policy "cc_select" on content_calendars
  for select to authenticated
  using (organization_id = (select organization_id from profiles where id = auth.uid()));

create policy "cc_insert" on content_calendars
  for insert to authenticated
  with check (organization_id = (select organization_id from profiles where id = auth.uid()));

create policy "cc_update" on content_calendars
  for update to authenticated
  using (organization_id = (select organization_id from profiles where id = auth.uid()));

create index idx_cc_status on content_calendars(status) where status in ('pendente_geracao', 'gerando');
create index idx_cc_client_mes on content_calendars(client_id, mes_referencia);
