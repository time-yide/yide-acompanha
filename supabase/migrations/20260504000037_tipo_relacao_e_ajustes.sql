-- supabase/migrations/20260504000037_tipo_relacao_e_ajustes.sql

-- =============================================
-- 1) Enum tipo_relacao_cliente
-- =============================================
create type public.tipo_relacao_cliente as enum (
  'comum',      -- cliente pagante normal
  'parceria',   -- parceria (sem $)
  'permuta'     -- troca de serviços (sem $)
);

alter table public.clients
  add column if not exists tipo_relacao public.tipo_relacao_cliente
    not null default 'comum';

create index if not exists idx_clients_tipo_relacao on public.clients(tipo_relacao);

-- =============================================
-- 2) Tabela client_monthly_adjustments
-- =============================================
create type public.tipo_ajuste_mensal as enum (
  'desconto_parcial',
  'gratuidade_total'
);

create table public.client_monthly_adjustments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  mes_referencia text not null,                       -- 'YYYY-MM'
  tipo public.tipo_ajuste_mensal not null,
  valor_desconto numeric(12,2),                       -- só pra desconto_parcial; null pra gratuidade
  motivo text not null check (length(trim(motivo)) >= 3),
  criado_por uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (client_id, mes_referencia)                  -- 1 ajuste por mês
);

create index idx_adjustments_client_mes on public.client_monthly_adjustments(client_id, mes_referencia);
create index idx_adjustments_mes on public.client_monthly_adjustments(mes_referencia);

-- =============================================
-- 3) RLS pra client_monthly_adjustments
-- =============================================
alter table public.client_monthly_adjustments enable row level security;

create policy "all authenticated read adjustments"
  on public.client_monthly_adjustments for select to authenticated using (true);

create policy "adm/socio insert adjustments"
  on public.client_monthly_adjustments for insert to authenticated
  with check (
    public.current_user_role() in ('adm', 'socio')
    and criado_por = auth.uid()
  );

create policy "adm/socio update adjustments"
  on public.client_monthly_adjustments for update to authenticated
  using (public.current_user_role() in ('adm', 'socio'))
  with check (public.current_user_role() in ('adm', 'socio'));

create policy "adm/socio delete adjustments"
  on public.client_monthly_adjustments for delete to authenticated
  using (public.current_user_role() in ('adm', 'socio'));

-- =============================================
-- 4) Validação extra: desconto_parcial precisa de valor_desconto > 0
-- =============================================
alter table public.client_monthly_adjustments
  add constraint chk_desconto_parcial_tem_valor
  check (
    (tipo = 'desconto_parcial' and valor_desconto is not null and valor_desconto > 0)
    or (tipo = 'gratuidade_total' and valor_desconto is null)
  );
