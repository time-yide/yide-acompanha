-- supabase/migrations/20260426000001_organizations.sql
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text,
  logo_url text,
  created_at timestamptz not null default now()
);

-- Estruturado para multi-tenant futuro, mas só uma linha por enquanto
insert into public.organizations (nome) values ('Yide Digital');

alter table public.organizations enable row level security;

-- Todos os usuários autenticados podem ler a única organização
create policy "authenticated can read organizations"
  on public.organizations for select
  to authenticated
  using (true);
