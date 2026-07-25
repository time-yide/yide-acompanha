-- "Acessos internos": logins de sistemas/contas da própria agência (Meta
-- Business, Canva, banco, etc.), com visibilidade por acesso.
--   'time'     → todo colaborador logado vê
--   'restrito' → só gestão (sócio/adm/coordenador)
-- Senha criptografada (mesmo esquema AES-256-GCM das credenciais de cliente).
do $$ begin
  create type public.internal_credential_visibility as enum ('time', 'restrito');
exception when duplicate_object then null; end $$;

create table if not exists public.internal_credentials (
  id uuid primary key default gen_random_uuid(),
  service_name text not null,
  username text,
  password_encrypted text not null,          -- "iv:tag:ciphertext" hex
  notes text,
  visibility public.internal_credential_visibility not null default 'restrito',
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.internal_credentials enable row level security;
-- Acesso sempre via service-role (actions/queries fazem o gate por role no código).
