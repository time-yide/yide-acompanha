-- supabase/migrations/20260618000100_freelayide_urgencia.sql
-- Urgência de entrega para oportunidades de Edição.
alter table public.freela_oportunidades
  add column if not exists entrega_urgente boolean not null default false,
  add column if not exists prazo_entrega timestamptz;
