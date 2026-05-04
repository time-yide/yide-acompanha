-- supabase/migrations/20260504000035_auth_rate_limit.sql
-- Rate limit Postgres-backed pra /login e /recuperar-senha.
-- Supabase Auth já tem rate limit no nível do auth API, este é defense-in-depth
-- da nossa camada de aplicação (com janela e UX customizada).

create table public.auth_rate_limit (
  key text primary key,                       -- 'login:email' ou 'reset:email'
  attempts int not null default 0,
  window_start timestamptz not null default now(),
  blocked_until timestamptz
);

create index idx_auth_rate_limit_blocked
  on public.auth_rate_limit(blocked_until)
  where blocked_until is not null;

-- RLS: só service-role escreve. Nenhuma policy = ninguém autenticado lê/escreve.
alter table public.auth_rate_limit enable row level security;

-- Função idempotente: incrementa attempts, retorna se está bloqueado e
-- quanto tempo falta. Service-definer pra bypassar RLS.
create or replace function public.check_auth_rate_limit(
  rate_key text,
  max_attempts int,
  window_seconds int,
  block_seconds int default 900       -- 15 min default
)
returns table (allowed boolean, retry_after_seconds int)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.auth_rate_limit%rowtype;
  now_ts timestamptz := now();
begin
  -- Pega ou cria a linha
  select * into current_row from public.auth_rate_limit where key = rate_key;

  -- Se está bloqueado, retorna allowed=false
  if current_row.blocked_until is not null and current_row.blocked_until > now_ts then
    return query select
      false,
      extract(epoch from (current_row.blocked_until - now_ts))::int;
    return;
  end if;

  -- Janela expirou? reset
  if current_row.key is null or
     current_row.window_start + (window_seconds || ' seconds')::interval < now_ts then
    insert into public.auth_rate_limit (key, attempts, window_start, blocked_until)
    values (rate_key, 1, now_ts, null)
    on conflict (key) do update set
      attempts = 1,
      window_start = now_ts,
      blocked_until = null;
    return query select true, 0;
    return;
  end if;

  -- Incrementa
  update public.auth_rate_limit
  set attempts = attempts + 1,
      blocked_until = case
        when attempts + 1 >= max_attempts
          then now_ts + (block_seconds || ' seconds')::interval
        else null
      end
  where key = rate_key
  returning * into current_row;

  if current_row.blocked_until is not null then
    return query select
      false,
      extract(epoch from (current_row.blocked_until - now_ts))::int;
    return;
  end if;

  return query select true, 0;
end;
$$;

grant execute on function public.check_auth_rate_limit(text, int, int, int) to authenticated, anon, service_role;

-- Função pra resetar manualmente (ex: usuário fez login com sucesso, zera tentativas)
create or replace function public.reset_auth_rate_limit(rate_key text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.auth_rate_limit where key = rate_key;
$$;

grant execute on function public.reset_auth_rate_limit(text) to authenticated, anon, service_role;
