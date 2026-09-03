-- Tabela nichos
create table nichos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  nome text not null,
  slug text not null,
  datas_comemorativas jsonb not null default '[]'::jsonb,
  palavras_chave text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (organization_id, slug)
);

alter table nichos enable row level security;

create policy "nichos_select" on nichos
  for select to authenticated
  using (organization_id = (select organization_id from profiles where id = auth.uid()));

create policy "nichos_insert" on nichos
  for insert to authenticated
  with check (
    organization_id = (select organization_id from profiles where id = auth.uid())
    and exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "nichos_update" on nichos
  for update to authenticated
  using (
    organization_id = (select organization_id from profiles where id = auth.uid())
    and exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "nichos_delete" on nichos
  for delete to authenticated
  using (
    organization_id = (select organization_id from profiles where id = auth.uid())
    and exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Campo nicho_id em clients
alter table clients add column nicho_id uuid references nichos(id);
create index idx_clients_nicho on clients(nicho_id);
