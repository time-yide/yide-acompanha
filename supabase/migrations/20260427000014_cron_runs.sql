-- supabase/migrations/20260427000014_cron_runs.sql
-- Idempotência do cron. PK (job_name, run_date) bloqueia re-execução no mesmo dia.

create table public.cron_runs (
  job_name text not null,
  run_date date not null,
  ran_at timestamptz not null default now(),
  details jsonb,
  primary key (job_name, run_date)
);

alter table public.cron_runs enable row level security;
-- Sem policies: acessado só via service-role no endpoint do cron e nos detectors.
