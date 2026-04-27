-- supabase/migrations/20260427000013_notification_preferences.sql
-- Preferências individuais por (user_id, evento_tipo). Cada user gerencia o seu.

create table public.notification_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  evento_tipo public.notification_event not null,
  in_app boolean not null default true,
  email boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, evento_tipo)
);

alter table public.notification_preferences enable row level security;

create policy "users read own preferences"
  on public.notification_preferences for select to authenticated
  using (user_id = auth.uid());

create policy "users insert own preferences"
  on public.notification_preferences for insert to authenticated
  with check (user_id = auth.uid());

create policy "users update own preferences"
  on public.notification_preferences for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "users delete own preferences"
  on public.notification_preferences for delete to authenticated
  using (user_id = auth.uid());
