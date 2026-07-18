-- Presença real por heartbeat.
--
-- O HeartbeatProvider pinga a cada ~30s enquanto a aba está aberta e visível,
-- mas até agora só sobrescrevia profiles.last_seen_at (histórico jogado fora).
-- O "tempo ativo" era remontado de activity_events esparsos (só cliques), o que
-- subestimava brutalmente o tempo real com o app aberto.
--
-- Aqui guardamos presença em buckets de 1 minuto (upsert idempotente por minuto,
-- ~20× menos linhas do que 1 por ping) e agregamos em Postgres via RPC pra não
-- puxar centenas de milhares de linhas pro server na visão "mês".

create table if not exists public.presence_minutes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  minute timestamptz not null,
  primary key (user_id, minute)
);

-- Consulta é sempre por janela de tempo (range dia/semana/mês) agregando por user.
create index if not exists presence_minutes_minute_idx
  on public.presence_minutes (minute);

alter table public.presence_minutes enable row level security;
-- Só service-role escreve/lê (heartbeatAction + queries). Sem policies públicas:
-- RLS ligado sem policy = ninguém além do service-role acessa.

-- Agrega segundos de presença por usuário numa janela. Cada minuto distinto vale
-- 60s (a PK garante 1 linha por minuto por user, então count(*) já é distinto).
create or replace function public.presence_seconds_by_user(
  p_since timestamptz,
  p_until timestamptz
)
returns table(user_id uuid, seconds bigint)
language sql
stable
security definer
set search_path = public
as $$
  select pm.user_id, count(*)::bigint * 60 as seconds
  from public.presence_minutes pm
  where pm.minute >= p_since and pm.minute < p_until
  group by pm.user_id;
$$;

-- Retenção: pings antigos não servem pra nada depois que o mês fecha. Poda
-- manual ou via cron futuro:
--   delete from public.presence_minutes where minute < now() - interval '120 days';
