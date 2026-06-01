-- Canal de aquisicao do lead pro onboarding (Comercial Ligacao vs Rua).
alter table public.leads
  add column if not exists canal text not null default 'ligacao'
    check (canal in ('ligacao','rua'));
create index if not exists leads_canal_idx on public.leads(canal);
