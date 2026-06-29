-- Contas conectadas no Outstand, por cliente (Google Meu Negócio).
create table if not exists public.client_outstand_accounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  plataforma text not null check (plataforma in ('google_business')),
  account_id text not null,
  username text,
  conectado_em timestamptz not null default now(),
  unique (client_id, plataforma)
);
create index if not exists client_outstand_client_idx on public.client_outstand_accounts(client_id);
alter table public.client_outstand_accounts enable row level security;
drop policy if exists client_outstand_select on public.client_outstand_accounts;
create policy client_outstand_select on public.client_outstand_accounts for select to authenticated using (true);
drop policy if exists client_outstand_insert on public.client_outstand_accounts;
create policy client_outstand_insert on public.client_outstand_accounts for insert to authenticated with check (true);
drop policy if exists client_outstand_update on public.client_outstand_accounts;
create policy client_outstand_update on public.client_outstand_accounts for update to authenticated using (true);
drop policy if exists client_outstand_delete on public.client_outstand_accounts;
create policy client_outstand_delete on public.client_outstand_accounts for delete to authenticated using (true);
