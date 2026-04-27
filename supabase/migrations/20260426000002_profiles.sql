-- supabase/migrations/20260426000002_profiles.sql
create type public.user_role as enum ('adm', 'socio', 'comercial', 'coordenador', 'assessor');
create type public.theme_preference as enum ('light', 'dark', 'system');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  role public.user_role not null,
  nome text not null,
  email text not null unique,
  telefone text,
  endereco text,
  pix text,
  data_nascimento date,
  data_admissao date,
  fixo_mensal numeric(12, 2) default 0 not null,
  comissao_percent numeric(5, 2) default 0 not null,
  comissao_primeiro_mes_percent numeric(5, 2) default 0 not null,
  tema_preferido public.theme_preference not null default 'system',
  ativo boolean not null default true,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_role on public.profiles(role);
create index idx_profiles_ativo on public.profiles(ativo);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
