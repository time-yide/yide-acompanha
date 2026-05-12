-- =====================================================
-- LIGAÇÕES — Instâncias / Números cadastrados
-- Cada instância representa um número/ramal conectado a um provedor.
-- Ex: "Ramal Yasmin — Telefone +5511999999999 (iFix ramal 1001)"
-- =====================================================

create table if not exists public.ligacoes_instancias (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  -- Nome amigável da instância (aparece em filtros, dashboards)
  nome text not null,                    -- ex: "Ramal Yasmin", "WPP Comercial 2"
  tipo text not null check (tipo in ('telefone','whatsapp')),

  -- Quem usa essa instância (1 colaborador por instância)
  colaborador_id uuid references public.profiles(id) on delete set null,

  -- Número conectado (com DDI)
  numero text,                           -- "+5511999999999"
  ramal text,                            -- "1001" (pra PABX que tem ramais)

  -- Provedor
  provedor text not null default 'manual'
    check (provedor in ('twilio','ifix','3cx','totalvoice','vonage','evolution','zapi','chatpro','manual','outro')),

  -- Credenciais específicas do provedor (JSON flexível)
  -- Ex Twilio: { account_sid, auth_token }
  -- Ex Evolution: { url_base, api_key, instance_id }
  -- Ex iFix: { url_api, token, ramal_id }
  -- Em produção, considerar criptografar com pgcrypto (Fase futura)
  credenciais jsonb not null default '{}'::jsonb,

  -- Webhook URL gerada (cliente cola no provedor)
  webhook_secret text default gen_random_uuid()::text,

  -- Status atual
  status text not null default 'desconectado'
    check (status in ('desconectado','aguardando_qr','conectado','erro')),
  status_mensagem text,                  -- detalhes do erro / status

  -- Estatísticas leves
  total_ligacoes int not null default 0,
  ultimo_evento_em timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  arquivado_em timestamptz
);

create index if not exists ligacoes_instancias_org_idx
  on public.ligacoes_instancias(organization_id)
  where arquivado_em is null;
create index if not exists ligacoes_instancias_colaborador_idx
  on public.ligacoes_instancias(colaborador_id)
  where arquivado_em is null;
create index if not exists ligacoes_instancias_provedor_idx
  on public.ligacoes_instancias(provedor)
  where arquivado_em is null;

drop trigger if exists ligacoes_instancias_set_updated_at on public.ligacoes_instancias;
create trigger ligacoes_instancias_set_updated_at
  before update on public.ligacoes_instancias
  for each row execute function public.set_updated_at();

alter table public.ligacoes_instancias enable row level security;

drop policy if exists ligacoes_instancias_select on public.ligacoes_instancias;
create policy ligacoes_instancias_select on public.ligacoes_instancias
  for select to authenticated using (true);

drop policy if exists ligacoes_instancias_insert on public.ligacoes_instancias;
create policy ligacoes_instancias_insert on public.ligacoes_instancias
  for insert to authenticated with check (true);

drop policy if exists ligacoes_instancias_update on public.ligacoes_instancias;
create policy ligacoes_instancias_update on public.ligacoes_instancias
  for update to authenticated using (true);

-- Liga ligacoes às instâncias (opcional — backwards compatible)
alter table public.ligacoes
  add column if not exists instancia_id uuid references public.ligacoes_instancias(id) on delete set null;

create index if not exists ligacoes_instancia_idx
  on public.ligacoes(instancia_id) where arquivado_em is null;
