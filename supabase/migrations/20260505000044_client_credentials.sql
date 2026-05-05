-- supabase/migrations/20260505000044_client_credentials.sql
-- Cofre de credenciais por cliente: senha do Facebook, Instagram, Google Ads, etc.
--
-- Modelo de segurança:
-- 1) Senhas armazenadas CRIPTOGRAFADAS (AES-256-GCM) no app antes de inserir.
--    O DB nunca vê plaintext.
-- 2) RLS bloqueia acesso direto via cliente Supabase (anon/auth roles).
--    Toda operação passa por Server Actions com checagem de permissão no app.
-- 3) Log de acesso (`credential_access_log`) registra cada vez que alguém
--    revela uma senha. Útil pra auditoria pós-incidente.
--
-- Permissões (enforçadas no app):
-- - socio, adm: acesso a todas as credenciais
-- - assessor, coordenador: só credenciais de clientes onde é responsável
-- - outros roles: sem acesso

create table if not exists public.client_credentials (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  service_name text not null,                        -- "Facebook", "Instagram", "Google Ads"
  username text,                                     -- email/usuário (opcional)
  password_encrypted text not null,                  -- formato "iv:tag:ciphertext" hex
  notes text,                                        -- observações (texto livre, não criptografado)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  constraint chk_service_name_not_empty check (length(trim(service_name)) > 0),
  constraint chk_password_encrypted_not_empty check (length(trim(password_encrypted)) > 0)
);

create index if not exists idx_client_credentials_client_id on public.client_credentials(client_id);

create table if not exists public.credential_access_log (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid not null references public.client_credentials(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete set null,
  action text not null,                              -- 'view' | 'create' | 'update' | 'delete'
  accessed_at timestamptz not null default now(),
  constraint chk_action_valid check (action in ('view', 'create', 'update', 'delete'))
);

create index if not exists idx_credential_access_log_credential on public.credential_access_log(credential_id);
create index if not exists idx_credential_access_log_user on public.credential_access_log(user_id);
create index if not exists idx_credential_access_log_accessed_at on public.credential_access_log(accessed_at desc);

-- Trigger: mantém updated_at fresh
create or replace function public._touch_credential_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_client_credentials_touch on public.client_credentials;
create trigger trg_client_credentials_touch
  before update on public.client_credentials
  for each row execute function public._touch_credential_updated_at();

-- RLS — habilita e bloqueia tudo. Acesso só via service-role nas Server Actions.
-- (Mesmo padrão do `tasks` e `clients` neste projeto: app-layer enforcement.)
alter table public.client_credentials enable row level security;
alter table public.credential_access_log enable row level security;

-- Sem policies = nada passa pra anon/authenticated. Service role sempre passa.
-- (Política explícita "deny all" não é necessária — ausência de policy = bloqueio.)
