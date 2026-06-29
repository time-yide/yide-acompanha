-- Contas conectadas no Post for Me, por cliente + rede (TikTok/YouTube/LinkedIn).
create table if not exists public.client_postforme_accounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  plataforma text not null check (plataforma in ('tiktok','youtube','linkedin')),
  account_id text not null,
  username text,
  conectado_em timestamptz not null default now(),
  unique (client_id, plataforma)
);
create index if not exists client_pfm_client_idx on public.client_postforme_accounts(client_id);
alter table public.client_postforme_accounts enable row level security;
drop policy if exists client_pfm_select on public.client_postforme_accounts;
create policy client_pfm_select on public.client_postforme_accounts for select to authenticated using (true);
drop policy if exists client_pfm_insert on public.client_postforme_accounts;
create policy client_pfm_insert on public.client_postforme_accounts for insert to authenticated with check (true);
drop policy if exists client_pfm_update on public.client_postforme_accounts;
create policy client_pfm_update on public.client_postforme_accounts for update to authenticated using (true);
drop policy if exists client_pfm_delete on public.client_postforme_accounts;
create policy client_pfm_delete on public.client_postforme_accounts for delete to authenticated using (true);
