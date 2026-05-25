-- supabase/migrations/20260608000000_trafego_relatorios.sql
--
-- Tabela de relatórios de tráfego pago entregues ao cliente final.
-- Cada relatório tem slides JSONB (mesmo shape do apresenta-yide + template
-- novo grafico_barras), dados crus (Meta API e/ou manual) e um PDF salvo
-- no Storage. Cliente só vê quando assessor seta `publicado_em`.

create table public.trafego_relatorios (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clients(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  unit_id uuid references public.units(id),

  periodo_inicio date not null,
  periodo_fim date not null,
  constraint trafego_relatorios_periodo_ok check (periodo_fim >= periodo_inicio),

  -- Texto livre do assessor que vira input do prompt IA.
  objetivo text,

  -- meta_api = 100% Meta, manual = 100% form, hibrido = Meta + complemento manual.
  fonte_dados text not null
    check (fonte_dados in ('meta_api', 'manual', 'hibrido')),

  -- Snapshot bruto do que veio da Meta (cache: não re-bate na API ao reabrir).
  dados_meta jsonb,
  -- O que o assessor digitou/editou.
  dados_manuais jsonb,

  -- Array de slides validados em runtime (ver tipos.ts).
  slides jsonb not null default '[]'::jsonb,

  status text not null default 'rascunho'
    check (status in ('rascunho','gerando','pronta','erro')),

  pdf_storage_path text,
  publicado_em timestamptz,

  criado_por uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_trafego_relatorios_cliente_periodo
  on public.trafego_relatorios (cliente_id, periodo_inicio desc);

create index idx_trafego_relatorios_publicado
  on public.trafego_relatorios (cliente_id, publicado_em desc)
  where publicado_em is not null;

create trigger trg_trafego_relatorios_updated_at
  before update on public.trafego_relatorios
  for each row execute function public.set_updated_at();

-- Bucket de Storage pros PDFs gerados. Privado — acesso só via signed URL
-- gerada pela server action.
insert into storage.buckets (id, name, public)
values ('relatorios-trafego', 'relatorios-trafego', false)
on conflict (id) do nothing;

-- ─── RLS ────────────────────────────────────────────────────────────────
alter table public.trafego_relatorios enable row level security;

-- Equipe interna: socio/adm tudo; coord/assessor/comercial filtram pela
-- unit_id do próprio profile. Não usa is_unit_master() aqui porque o filtro
-- por unidade é parte da hierarquia natural (assessor da Matriz não vê
-- relatório de Salvador).
create policy "trafego_relatorios select equipe"
  on public.trafego_relatorios for select to authenticated
  using (
    (
      public.current_user_role() in ('socio', 'adm')
    ) or (
      public.current_user_role() in ('coordenador', 'assessor', 'comercial')
      and (unit_id is null or unit_id = public.current_user_unit_id())
    )
  );

-- Cliente do portal só vê o que está publicado, e só do PRÓPRIO cliente.
-- O JWT do portal carrega cliente_id em raw_user_meta_data.client_id.
create policy "trafego_relatorios select cliente portal"
  on public.trafego_relatorios for select to authenticated
  using (
    publicado_em is not null
    and cliente_id = ((auth.jwt() -> 'user_metadata' ->> 'client_id')::uuid)
  );

create policy "trafego_relatorios insert equipe"
  on public.trafego_relatorios for insert to authenticated
  with check (
    public.current_user_role() in ('socio', 'adm', 'coordenador', 'assessor', 'comercial')
  );

create policy "trafego_relatorios update equipe"
  on public.trafego_relatorios for update to authenticated
  using (public.current_user_role() in ('socio', 'adm', 'coordenador', 'assessor', 'comercial'))
  with check (public.current_user_role() in ('socio', 'adm', 'coordenador', 'assessor', 'comercial'));

create policy "trafego_relatorios delete equipe"
  on public.trafego_relatorios for delete to authenticated
  using (public.current_user_role() in ('socio', 'adm'));

comment on table public.trafego_relatorios is
  'Relatórios mensais de tráfego pago gerados com IA + identidade Yide. '
  'Cliente do portal só lê quando publicado_em is not null.';
