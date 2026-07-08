-- supabase/migrations/20260708000100_anuncios_ecommerce.sql
-- Setor E-commerce: registro por lote/dia de anúncios (listagens de marketplace)
-- subidos por assessor para cada cliente.

create table if not exists public.anuncios_ecommerce (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  colaborador_id uuid references public.profiles(id) on delete set null,
  data date not null default current_date,
  quantidade integer not null check (quantidade > 0),
  marketplace text not null check (marketplace in
    ('mercado_livre','shopee','amazon','magalu','outro')),
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  arquivado_em timestamptz
);

create index if not exists anuncios_ecommerce_org_data_idx
  on public.anuncios_ecommerce(organization_id, data desc) where arquivado_em is null;
create index if not exists anuncios_ecommerce_client_idx
  on public.anuncios_ecommerce(client_id) where arquivado_em is null;
create index if not exists anuncios_ecommerce_colaborador_idx
  on public.anuncios_ecommerce(colaborador_id) where arquivado_em is null;

drop trigger if exists anuncios_ecommerce_set_updated_at on public.anuncios_ecommerce;
create trigger anuncios_ecommerce_set_updated_at
  before update on public.anuncios_ecommerce
  for each row execute function public.set_updated_at();

alter table public.anuncios_ecommerce enable row level security;
drop policy if exists anuncios_ecommerce_select on public.anuncios_ecommerce;
create policy anuncios_ecommerce_select on public.anuncios_ecommerce
  for select to authenticated using (true);
drop policy if exists anuncios_ecommerce_insert on public.anuncios_ecommerce;
create policy anuncios_ecommerce_insert on public.anuncios_ecommerce
  for insert to authenticated with check (true);
drop policy if exists anuncios_ecommerce_update on public.anuncios_ecommerce;
create policy anuncios_ecommerce_update on public.anuncios_ecommerce
  for update to authenticated using (true);
