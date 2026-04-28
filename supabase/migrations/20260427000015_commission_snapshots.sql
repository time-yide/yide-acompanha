-- supabase/migrations/20260427000015_commission_snapshots.sql

create type public.snapshot_status as enum ('pending_approval', 'aprovado');

create type public.snapshot_item_tipo as enum (
  'fixo',
  'carteira_assessor',
  'carteira_coord_agencia',
  'deal_fechado_comercial'
);

create table public.commission_snapshots (
  id uuid primary key default gen_random_uuid(),
  mes_referencia text not null,
  user_id uuid not null references public.profiles(id),
  papel_naquele_mes text not null,
  fixo numeric(12,2) not null default 0,
  percentual_aplicado numeric(5,2) not null default 0,
  base_calculo numeric(12,2) not null default 0,
  valor_variavel numeric(12,2) not null default 0,
  ajuste_manual numeric(12,2) not null default 0,
  valor_total numeric(12,2) not null default 0,
  status public.snapshot_status not null default 'pending_approval',
  aprovado_por uuid references public.profiles(id),
  aprovado_em timestamptz,
  justificativa_ajuste text,
  created_at timestamptz not null default now()
);

create unique index uq_commission_snapshots_user_mes
  on public.commission_snapshots(user_id, mes_referencia);

create index idx_commission_snapshots_mes_status
  on public.commission_snapshots(mes_referencia, status);

alter table public.commission_snapshots enable row level security;

create policy "users read own snapshots"
  on public.commission_snapshots for select to authenticated
  using (
    user_id = auth.uid()
    or public.current_user_role() in ('adm', 'socio')
  );

create policy "socio updates snapshots"
  on public.commission_snapshots for update to authenticated
  using (public.current_user_role() = 'socio')
  with check (public.current_user_role() = 'socio');

-- Insert/Delete sem policy: feitos via service-role no cron e em emergências.

create table public.commission_snapshot_items (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.commission_snapshots(id) on delete cascade,
  tipo public.snapshot_item_tipo not null,
  descricao text not null,
  base numeric(12,2) not null default 0,
  percentual numeric(5,2) not null default 0,
  valor numeric(12,2) not null default 0,
  client_id uuid references public.clients(id),
  lead_id uuid references public.leads(id),
  created_at timestamptz not null default now()
);

create index idx_commission_snapshot_items_snapshot
  on public.commission_snapshot_items(snapshot_id);

alter table public.commission_snapshot_items enable row level security;

create policy "items follow snapshot rls"
  on public.commission_snapshot_items for select to authenticated
  using (
    exists (
      select 1 from public.commission_snapshots cs
      where cs.id = snapshot_id
        and (cs.user_id = auth.uid() or public.current_user_role() in ('adm', 'socio'))
    )
  );
-- Insert/Update/Delete sem policy: via service-role.
