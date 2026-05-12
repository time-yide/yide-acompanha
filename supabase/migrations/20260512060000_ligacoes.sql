-- =====================================================
-- LIGAÇÕES — FASE 1
-- Dashboard de chamadas (telefone + WhatsApp) da equipe comercial.
-- Schema flexível pra acomodar integrações futuras com:
--   - Telefonia: Twilio, iFix, 3CX, TotalVoice, Vonage
--   - WhatsApp: Evolution, Z-API, ChatPro, WhatsApp Business
-- =====================================================

create table if not exists public.ligacoes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  -- Tipo de canal
  tipo text not null check (tipo in ('telefone','whatsapp')),

  -- Quem fez/recebeu a chamada (colaborador da Yide)
  colaborador_id uuid references public.profiles(id) on delete set null,

  -- Pra quem ligou
  numero text not null,                          -- formato livre, mas geralmente +5511...
  contato_nome text,                             -- nome do lead/cliente, se conhecido

  -- Vínculos opcionais (mostra "Lead: X" / "Cliente: Y" na tabela)
  lead_id uuid references public.leads(id) on delete set null,
  lead_gerado_id uuid references public.leads_gerados(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,

  -- Direção
  direcao text not null default 'saida' check (direcao in ('saida','entrada')),

  -- Status final da chamada
  status text not null check (status in (
    'atendida',         -- conversa aconteceu
    'perdida',          -- não atendeu, tocou e desligou
    'rejeitada',        -- atendeu e desligou rápido (< 5s) ou pessoa do outro lado rejeitou
    'caixa_postal',     -- foi pra caixa postal
    'ocupada',          -- número ocupado
    'cancelada',        -- usuário cancelou antes do destino atender
    'em_andamento'      -- chamada ativa (real-time)
  )),

  -- Tempo
  iniciada_em timestamptz not null,
  finalizada_em timestamptz,
  duracao_segundos int not null default 0,

  -- Conteúdo
  observacoes text,
  gravacao_url text,                             -- URL da gravação (signed URL se vier do nosso storage)
  transcricao text,                              -- transcrição automática (IA — futuro)
  resumo_ia text,                                -- resumo IA (futuro)

  -- Origem / integração
  origem text not null default 'manual'
    check (origem in ('manual','twilio','evolution','zapi','ifix','voip_generic','mock','outro')),
  external_id text,                              -- ID na plataforma externa (Twilio call SID, etc.)
  raw_data jsonb,                                -- payload cru da integração

  -- Tags livres (ex: 'hot lead', 'follow-up')
  tags text[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  arquivado_em timestamptz
);

create index if not exists ligacoes_org_iniciada_idx
  on public.ligacoes(organization_id, iniciada_em desc)
  where arquivado_em is null;
create index if not exists ligacoes_colaborador_idx
  on public.ligacoes(colaborador_id, iniciada_em desc)
  where arquivado_em is null;
create index if not exists ligacoes_status_idx
  on public.ligacoes(status)
  where arquivado_em is null;
create index if not exists ligacoes_tipo_idx
  on public.ligacoes(tipo)
  where arquivado_em is null;
create index if not exists ligacoes_numero_idx
  on public.ligacoes(numero);
create index if not exists ligacoes_external_idx
  on public.ligacoes(origem, external_id)
  where external_id is not null;

-- updated_at trigger
drop trigger if exists ligacoes_set_updated_at on public.ligacoes;
create trigger ligacoes_set_updated_at
  before update on public.ligacoes
  for each row execute function public.set_updated_at();

alter table public.ligacoes enable row level security;

drop policy if exists ligacoes_select on public.ligacoes;
create policy ligacoes_select on public.ligacoes
  for select to authenticated using (true);

drop policy if exists ligacoes_insert on public.ligacoes;
create policy ligacoes_insert on public.ligacoes
  for insert to authenticated with check (true);

drop policy if exists ligacoes_update on public.ligacoes;
create policy ligacoes_update on public.ligacoes
  for update to authenticated using (true);
