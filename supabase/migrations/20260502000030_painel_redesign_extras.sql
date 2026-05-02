-- supabase/migrations/20260502000030_painel_redesign_extras.sql

-- 'delegado' como status (design e edição usam principalmente)
alter type public.checklist_step_status add value if not exists 'delegado';

-- Extends client_monthly_checklist com fields da Fase 1
alter table public.client_monthly_checklist
  add column if not exists tpg_ativo boolean,
  add column if not exists tpm_ativo boolean,
  add column if not exists gmn_comentarios integer not null default 0,
  add column if not exists gmn_avaliacoes integer not null default 0,
  add column if not exists gmn_nota_media numeric(2,1),
  add column if not exists gmn_observacoes text;

-- Validação da nota
alter table public.client_monthly_checklist
  add constraint chk_gmn_nota_range
  check (gmn_nota_media is null or (gmn_nota_media >= 0 and gmn_nota_media <= 5));
