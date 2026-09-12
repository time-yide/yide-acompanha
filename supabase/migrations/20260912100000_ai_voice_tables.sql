-- ============================================================
-- Voz IA: OpenAI Realtime + Twilio Media Streams
-- Tabelas de configuração e registro de chamadas IA.
-- ============================================================

-- 1) ai_voice_configs — configuração do agente de voz (editável pela gestão)
create table if not exists public.ai_voice_configs (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references organizations(id),
  nome                   text not null default 'Padrão',
  system_prompt          text not null,
  voz                    text not null default 'alloy',
  temperatura            real not null default 0.8,
  duracao_max_segundos   int not null default 180,
  wpp_followup_ativo     boolean not null default true,
  wpp_followup_template  text,
  max_tentativas         int not null default 7,
  tentativas_por_semana  int not null default 2,
  ativo                  boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create unique index if not exists ai_voice_configs_org_ativo
  on ai_voice_configs(organization_id) where ativo = true;

alter table public.ai_voice_configs enable row level security;

create policy "ai_voice_configs_select" on public.ai_voice_configs
  for select using (
    organization_id in (select organization_id from profiles where id = auth.uid())
  );

-- 2) ai_voice_calls — registro de cada ligação IA
create table if not exists public.ai_voice_calls (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references organizations(id),
  lead_gerado_id       uuid not null references leads_gerados(id),
  config_id            uuid references ai_voice_configs(id),
  prompt_usado         text not null,
  voz                  text not null default 'alloy',
  twilio_call_sid      text,
  twilio_from          text not null,
  status               text not null default 'iniciando'
    check (status in (
      'iniciando','chamando','em_andamento',
      'reuniao_agendada','sem_interesse','nao_atendeu','erro'
    )),
  duracao_segundos     int,
  transcricao          jsonb,
  resumo_ia            text,
  resultado_detalhe    text,
  gravacao_url         text,
  calendar_event_id    uuid references calendar_events(id),
  reuniao_data         timestamptz,
  followup_wpp_enviado boolean not null default false,
  conversation_id      uuid references wpp_conversations(id),
  iniciado_por         uuid not null references auth.users(id),
  criado_em            timestamptz not null default now(),
  finalizado_em        timestamptz,
  erro_msg             text,
  raw_events           jsonb
);

create index if not exists ai_voice_calls_org_idx on ai_voice_calls(organization_id);
create index if not exists ai_voice_calls_lead_idx on ai_voice_calls(lead_gerado_id);
create index if not exists ai_voice_calls_status_idx on ai_voice_calls(status);

alter table public.ai_voice_calls enable row level security;

create policy "ai_voice_calls_select" on public.ai_voice_calls
  for select using (
    organization_id in (select organization_id from profiles where id = auth.uid())
  );

-- 3) Colunas novas em leads_gerados
alter table public.leads_gerados
  add column if not exists ai_tentativas int not null default 0,
  add column if not exists ai_proxima_tentativa timestamptz,
  add column if not exists ai_status text default null
    check (ai_status is null or ai_status in (
      'aguardando','em_ligacao','followup_wpp',
      'reuniao_agendada','sem_interesse','esgotado'
    ));
