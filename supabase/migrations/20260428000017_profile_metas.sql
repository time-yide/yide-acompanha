-- supabase/migrations/20260428000017_profile_metas.sql

alter table public.profiles
  add column if not exists meta_prospects_mes integer,
  add column if not exists meta_fechamentos_mes integer,
  add column if not exists meta_receita_mes numeric(12,2);

-- Sem default. Null = fallback automático calculado em runtime.
-- RLS existente cobre UPDATE (só Sócio/ADM ou próprio user).
