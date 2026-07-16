-- Ranking de clientes (snapshot das planilhas 2024-2026): total investido
-- (soma de todo o faturamento) e tempo de casa (meses ativos, sem pausas).
-- Snapshot pois o histórico não está no sistema cliente-a-cliente. Só sócio.
create table public.client_ranking (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nome text not null,
  total_investido numeric(14,2) not null default 0,
  meses_ativos integer not null default 0,
  primeiro_mes text not null,
  ultimo_mes text not null,
  ativo boolean not null default false,
  atualizado_em timestamptz not null default now()
);
create index idx_client_ranking_total on public.client_ranking(organization_id, total_investido desc);
alter table public.client_ranking enable row level security;
create policy "client_ranking rw socio" on public.client_ranking for all to authenticated
  using (public.current_user_role() = 'socio')
  with check (public.current_user_role() = 'socio');
