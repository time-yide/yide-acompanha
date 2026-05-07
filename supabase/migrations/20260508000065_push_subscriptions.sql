-- Tabela pra guardar Web Push subscriptions. Cada device/browser do user
-- gera uma subscription única (endpoint + chaves criptográficas). O server
-- envia push pra todas as subscriptions do user destinatário.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text null,
  created_at timestamptz not null default now()
);

-- Mesma URL de endpoint nunca duplica pro mesmo user (re-subscribe ou
-- multi-aba mesmo browser cai em UPSERT).
create unique index uq_push_subscriptions_user_endpoint
  on public.push_subscriptions(user_id, endpoint);

create index idx_push_subscriptions_user
  on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

-- User vê e gerencia só as próprias subscriptions. Backend usa
-- service-role pra ler de todos no momento do dispatch.
create policy "users manage own push subs"
  on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
