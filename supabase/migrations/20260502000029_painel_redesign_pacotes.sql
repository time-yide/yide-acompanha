-- supabase/migrations/20260502000029_painel_redesign_pacotes.sql

-- =============================================
-- Enum tipo_pacote
-- =============================================
create type public.tipo_pacote as enum (
  -- Aparecem no Painel Mensal:
  'trafego_estrategia',
  'trafego',
  'estrategia',
  'audiovisual',
  'yide_360',
  -- Pacotes do futuro Painel Dev (não aparecem no Painel Mensal):
  'site',
  'ia',
  'crm',
  'crm_ia'
);

-- =============================================
-- Enum cadencia_reuniao
-- =============================================
create type public.cadencia_reuniao as enum (
  'semanal',
  'quinzenal',
  'mensal',
  'trimestral'
);

-- =============================================
-- Novos campos em clients
-- =============================================
alter table public.clients
  add column if not exists tipo_pacote public.tipo_pacote,
  add column if not exists cadencia_reuniao public.cadencia_reuniao,
  add column if not exists numero_unidades integer not null default 1,
  add column if not exists valor_trafego_google numeric(12,2),
  add column if not exists valor_trafego_meta numeric(12,2),
  add column if not exists tipo_pacote_revisado boolean not null default false;

create index if not exists idx_clients_tipo_pacote on public.clients(tipo_pacote);
