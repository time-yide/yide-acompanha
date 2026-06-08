-- supabase/migrations/20260607000000_lead_attempts_lead_gerado.sql
-- Cadência "14 batidas": lead_attempts passa a aceitar também leads_gerados
-- (antes só aceitava leads de Onboarding). RLS é baseada em autor_id, então
-- tornar lead_id nullable + adicionar lead_gerado_id não afeta nenhuma policy.

alter table public.lead_attempts
  alter column lead_id drop not null;

alter table public.lead_attempts
  add column if not exists lead_gerado_id uuid
    references public.leads_gerados(id) on delete cascade;

-- exatamente um alvo preenchido (lead OU lead_gerado)
alter table public.lead_attempts
  drop constraint if exists lead_attempts_target_chk;
alter table public.lead_attempts
  add constraint lead_attempts_target_chk
  check ((lead_id is not null)::int + (lead_gerado_id is not null)::int = 1);

create index if not exists idx_lead_attempts_lead_gerado
  on public.lead_attempts(lead_gerado_id, created_at desc)
  where lead_gerado_id is not null;
