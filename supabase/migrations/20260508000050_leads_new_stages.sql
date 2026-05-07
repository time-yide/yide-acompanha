-- supabase/migrations/20260508000050_leads_new_stages.sql
-- Adiciona 3 novos valores ao enum lead_stage. A migração dos leads
-- existentes (prospeccao→leads_ativos, comercial→reuniao_comercial)
-- vai numa migration separada porque PG não permite usar enum value
-- recém-adicionado na mesma transação que ele foi criado.

alter type public.lead_stage add value if not exists 'leads_potencial' before 'prospeccao';
alter type public.lead_stage add value if not exists 'leads_ativos' after 'leads_potencial';
alter type public.lead_stage add value if not exists 'reuniao_comercial' after 'comercial';
