-- Painel Dados (spec 2026-11-22). Aplicar MANUALMENTE no SQL Editor após o merge.

alter table public.clients
  add column if not exists ga4_property_id text,
  add column if not exists gsc_site_url text;

comment on column public.clients.ga4_property_id is 'ID numérico da propriedade GA4 (ex.: 564211864). Lido pela conta de serviço.';
comment on column public.clients.gsc_site_url is 'Site do Search Console (ex.: sc-domain:atenarh.com.br ou https://atenarh.com.br/).';

create table if not exists public.client_dados_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  periodo_inicio date not null,
  periodo_fim date not null,
  nota int check (nota is null or (nota between 0 and 100)),
  nota_anterior int check (nota_anterior is null or (nota_anterior between 0 and 100)),
  canais jsonb not null default '{}'::jsonb,
  perdas jsonb not null default '[]'::jsonb,
  calculado_em timestamptz not null default now()
);

create index if not exists idx_client_dados_snapshots_client
  on public.client_dados_snapshots (client_id, calculado_em desc);

create unique index if not exists uq_client_dados_snapshots_dia
  on public.client_dados_snapshots (client_id, periodo_fim);

alter table public.client_dados_snapshots enable row level security;

-- Leitura: chefia/programação da org vê tudo; assessor vê os próprios clientes.
-- Escrita: só service-role (sem policy de insert/update).
drop policy if exists client_dados_snapshots_select on public.client_dados_snapshots;
create policy client_dados_snapshots_select on public.client_dados_snapshots
  for select to authenticated using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = client_dados_snapshots.organization_id
        and p.role in ('adm', 'socio', 'programacao')
    )
    or exists (
      select 1 from public.clients c
      where c.id = client_dados_snapshots.client_id and c.assessor_id = auth.uid()
    )
  );
