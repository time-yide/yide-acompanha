-- supabase/migrations/20260513000000_reunioes_fase1.sql
--
-- Módulo "Reuniões": gravação + transcrição + IA inspirado em tl;dv.
-- Schema preparado pra todas as fases do roadmap (OAuth, Calendar sync,
-- recording, transcription, summarization, tasks, insights), mas a
-- Fase 0 só usa as tables base + alguns enums.
--
-- NÃO APLICAR esta migration ainda — revise primeiro. Quando aplicar,
-- rode `npm run db:types` pra regenerar src/types/database.ts.

-- ─── Enums ──────────────────────────────────────────────────────────────────

create type public.meeting_status as enum (
  'scheduled',      -- agendada (vinda do Calendar)
  'in_progress',    -- bot conectado / gravação acontecendo
  'processing',     -- terminou, IA processando
  'completed',      -- pronta pra ver
  'failed',         -- erro em alguma etapa
  'cancelled'
);

create type public.meeting_source as enum (
  'google_meet',
  'zoom',
  'teams',
  'manual_upload'   -- usuário fez upload de áudio depois
);

create type public.meeting_processing_step as enum (
  'recording',
  'transcription',
  'summarization',
  'insights',
  'tasks_extraction',
  'follow_up'
);

create type public.meeting_processing_status as enum (
  'pending',
  'running',
  'done',
  'failed',
  'skipped'
);

-- ─── 1) Conexões OAuth Google (1 por colaborador) ──────────────────────────

create table public.google_oauth_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- Email da conta Google conectada (pode ser diferente do email do profile)
  google_email text not null,
  -- Tokens — IMPORTANTES, devem ser criptografados antes de gravar.
  -- Pra MVP guardamos em texto, mas TODO: migrar pra Vault/pgsodium.
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scopes text[] not null default array[]::text[],
  -- Sync state
  calendar_sync_token text,                       -- pra incremental sync
  calendar_last_synced_at timestamptz,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)                                 -- 1 conexão por user
);

create index idx_google_oauth_user on public.google_oauth_connections(user_id);
create index idx_google_oauth_org on public.google_oauth_connections(organization_id);

create trigger trg_google_oauth_updated_at
  before update on public.google_oauth_connections
  for each row execute function public.set_updated_at();

alter table public.google_oauth_connections enable row level security;
create policy "user le própria conexão"
  on public.google_oauth_connections for select to authenticated
  using (user_id = auth.uid() or public.current_user_role() in ('adm', 'socio'));
create policy "user atualiza própria conexão"
  on public.google_oauth_connections for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── 2) Reuniões ────────────────────────────────────────────────────────────

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  -- Quem é o "dono" — quem conectou a conta Google que trouxe essa reunião
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  -- Ligação opcional com lead / cliente
  lead_id uuid references public.leads(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,

  source public.meeting_source not null default 'google_meet',
  status public.meeting_status not null default 'scheduled',
  -- ID externo (Google Calendar event id, Zoom meeting id, etc.)
  external_id text,
  external_url text,                              -- meet.google.com/abc-defg-hij

  titulo text not null,
  descricao text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  duracao_segundos integer,                       -- preenchido pós-gravação
  -- Idiomas: pt-BR padrão; transcription provider precisa saber
  idioma text not null default 'pt-BR',

  -- Marcadores de processamento (resumo de tudo, pra UI mostrar status sem
  -- joinar meeting_processing_jobs)
  recording_ready boolean not null default false,
  transcript_ready boolean not null default false,
  summary_ready boolean not null default false,
  insights_ready boolean not null default false,

  -- Tags pra filtragem (ex.: "discovery", "kickoff", "alinhamento")
  tags text[] not null default array[]::text[],

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_meetings_org on public.meetings(organization_id);
create index idx_meetings_owner on public.meetings(owner_user_id);
create index idx_meetings_starts on public.meetings(starts_at desc);
create index idx_meetings_status on public.meetings(status);
create index idx_meetings_lead on public.meetings(lead_id);
create index idx_meetings_client on public.meetings(client_id);
create unique index idx_meetings_external on public.meetings(source, external_id)
  where external_id is not null;

create trigger trg_meetings_updated_at
  before update on public.meetings
  for each row execute function public.set_updated_at();

alter table public.meetings enable row level security;
-- Por enquanto: qualquer autenticado da organização lê. Quando tiver tipo
-- "reunião privada", refinar.
create policy "authenticated read meetings"
  on public.meetings for select to authenticated using (true);
create policy "owner insert meetings"
  on public.meetings for insert to authenticated
  with check (owner_user_id = auth.uid());
create policy "owner / adm update meetings"
  on public.meetings for update to authenticated
  using (owner_user_id = auth.uid() or public.current_user_role() in ('adm', 'socio'));

-- ─── 3) Participantes ──────────────────────────────────────────────────────

create table public.meeting_participants (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  -- Se for colaborador interno, linka. Senão (cliente, prospect), só nome+email.
  profile_id uuid references public.profiles(id) on delete set null,
  nome text not null,
  email text,
  -- "host", "attendee", "bot"
  papel text not null default 'attendee',
  -- Em segundos, quanto a pessoa ficou na call (preenchido pós-processamento)
  tempo_presenca_segundos integer,
  -- Em segundos, quanto a pessoa falou (analyzed da transcrição)
  tempo_falando_segundos integer,
  created_at timestamptz not null default now()
);

create index idx_meeting_participants_meeting on public.meeting_participants(meeting_id);
create index idx_meeting_participants_profile on public.meeting_participants(profile_id);

alter table public.meeting_participants enable row level security;
create policy "authenticated read participants"
  on public.meeting_participants for select to authenticated using (true);

-- ─── 4) Gravações (audio + video) ──────────────────────────────────────────

create table public.meeting_recordings (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  audio_url text,                                  -- Supabase Storage / S3
  video_url text,
  duracao_segundos integer,
  size_bytes bigint,
  formato text,                                    -- "mp3" | "mp4" | "webm" | "wav"
  -- Quando a gravação foi capturada (pode ser ≠ ends_at se uploaded depois)
  captured_at timestamptz,
  -- ID externo do provider (Recall.ai bot_id, etc.)
  provider text,                                   -- "recall" | "manual" | "google_meet_native"
  provider_id text,
  created_at timestamptz not null default now()
);

create index idx_meeting_recordings_meeting on public.meeting_recordings(meeting_id);

alter table public.meeting_recordings enable row level security;
create policy "authenticated read recordings"
  on public.meeting_recordings for select to authenticated using (true);

-- ─── 5) Transcrições ───────────────────────────────────────────────────────

create table public.meeting_transcripts (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  -- Provider usado (pra debug / cost tracking)
  provider text not null,                          -- "whisper" | "assemblyai" | "deepgram"
  modelo text,                                     -- "whisper-1" | "nova-2"
  idioma text not null default 'pt-BR',
  -- Texto contínuo da reunião — útil pra busca full-text
  texto_completo text not null,
  -- Segmentos com speaker + timestamps — pra timeline UI
  -- Schema: [{ speaker: string, speaker_id: string|null, start: number,
  --            end: number, text: string }, ...]
  segments jsonb not null default '[]'::jsonb,
  custo_estimado_centavos integer,                 -- pra dashboard de custos
  created_at timestamptz not null default now()
);

create index idx_meeting_transcripts_meeting on public.meeting_transcripts(meeting_id);
-- Full-text search em pt-BR pro "busca inteligente"
create index idx_meeting_transcripts_fts on public.meeting_transcripts
  using gin (to_tsvector('portuguese', coalesce(texto_completo, '')));

alter table public.meeting_transcripts enable row level security;
create policy "authenticated read transcripts"
  on public.meeting_transcripts for select to authenticated using (true);

-- ─── 6) Resumo / Insights / Tópicos / Tasks geradas ─────────────────────────

create table public.meeting_summaries (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  -- Provider de IA
  provider text not null default 'claude',
  modelo text,                                     -- "claude-sonnet-4-5-20250929"
  -- Resumo em prosa (3-5 parágrafos)
  resumo_geral text not null,
  -- Bullet de decisões tomadas
  decisoes text[] not null default array[]::text[],
  -- Próximos passos discutidos
  proximos_passos text[] not null default array[]::text[],
  -- Tópicos com timestamp ([{ titulo, start_seconds, end_seconds, resumo }])
  topicos jsonb not null default '[]'::jsonb,
  -- Insights mais qualitativos: objeções, sinais de compra, tom geral
  -- [{ tipo: 'objecao'|'sinal_compra'|'risco'|'oportunidade', texto, timestamp }]
  insights jsonb not null default '[]'::jsonb,
  -- Sentimento geral (-1.0 a 1.0)
  sentimento_score numeric(3,2),
  custo_estimado_centavos integer,
  created_at timestamptz not null default now()
);

create index idx_meeting_summaries_meeting on public.meeting_summaries(meeting_id);

alter table public.meeting_summaries enable row level security;
create policy "authenticated read summaries"
  on public.meeting_summaries for select to authenticated using (true);

-- ─── 7) Tasks extraídas da reunião ─────────────────────────────────────────

-- As tarefas extraídas viram registros em public.tasks (sistema já existe),
-- mas a gente liga via essa table pra rastrear origem.
create table public.meeting_extracted_tasks (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  -- Se virou task de verdade no sistema, linka. Pode ficar null se a IA
  -- sugeriu mas o user descartou.
  task_id uuid references public.tasks(id) on delete set null,
  titulo_sugerido text not null,
  descricao_sugerida text,
  atribuido_a_sugestao uuid references public.profiles(id) on delete set null,
  due_date_sugestao date,
  -- "sugerida" | "aceita" | "descartada"
  estado text not null default 'sugerida',
  citacao_origem text,                             -- trecho da transcrição que motivou
  timestamp_origem_segundos integer,
  created_at timestamptz not null default now()
);

create index idx_meeting_extracted_tasks_meeting on public.meeting_extracted_tasks(meeting_id);
create index idx_meeting_extracted_tasks_task on public.meeting_extracted_tasks(task_id);

alter table public.meeting_extracted_tasks enable row level security;
create policy "authenticated read extracted tasks"
  on public.meeting_extracted_tasks for select to authenticated using (true);
create policy "authenticated insert extracted tasks"
  on public.meeting_extracted_tasks for insert to authenticated with check (true);
create policy "authenticated update extracted tasks"
  on public.meeting_extracted_tasks for update to authenticated using (true);

-- ─── 8) Jobs de processamento (pra workers / observabilidade) ──────────────

create table public.meeting_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  step public.meeting_processing_step not null,
  status public.meeting_processing_status not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  -- Payload livre — provider response, etc.
  payload jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_meeting_processing_jobs_meeting on public.meeting_processing_jobs(meeting_id);
create index idx_meeting_processing_jobs_status on public.meeting_processing_jobs(status);

alter table public.meeting_processing_jobs enable row level security;
create policy "authenticated read jobs"
  on public.meeting_processing_jobs for select to authenticated using (true);

-- ─── 9) Audit hook: meetings entram no audit_log padrão ────────────────────

-- (audit já é tracked via logAudit nas server actions — não precisa trigger DB)
