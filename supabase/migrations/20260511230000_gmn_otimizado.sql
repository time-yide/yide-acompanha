-- Adiciona coluna gmn_otimizado em client_monthly_checklist
-- Indica se o GMN foi otimizado naquele mês (toggle manual).
alter table public.client_monthly_checklist
  add column if not exists gmn_otimizado boolean not null default false;
