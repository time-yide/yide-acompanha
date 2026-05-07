-- supabase/migrations/20260508000051_leads_migrate_stages.sql
-- Migra leads existentes para a nova nomenclatura do funil:
--   prospeccao  → leads_ativos       (já estavam sendo trabalhados)
--   comercial   → reuniao_comercial  (já chegaram à etapa comercial)
-- E ajusta o default da coluna pra "leads_potencial" (novos leads
-- começam frios na lista, comercial drag pra "leads_ativos" quando
-- começa a trabalhar).

update public.leads
set stage = 'leads_ativos'
where stage = 'prospeccao';

update public.leads
set stage = 'reuniao_comercial'
where stage = 'comercial';

-- Atualiza histórico também pra consistência da timeline
update public.lead_history
set from_stage = 'leads_ativos'
where from_stage = 'prospeccao';

update public.lead_history
set to_stage = 'leads_ativos'
where to_stage = 'prospeccao';

update public.lead_history
set from_stage = 'reuniao_comercial'
where from_stage = 'comercial';

update public.lead_history
set to_stage = 'reuniao_comercial'
where to_stage = 'comercial';

-- Default da coluna passa pra leads_potencial
alter table public.leads alter column stage set default 'leads_potencial';
