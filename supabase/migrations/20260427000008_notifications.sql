-- supabase/migrations/20260427000008_notifications.sql

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tipo text not null,
  titulo text not null,
  mensagem text not null,
  link text,
  lida boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_user_unread
  on public.notifications(user_id, lida, created_at desc);

alter table public.notifications enable row level security;

create policy "users read own notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy "users mark own notifications as read"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Insert e delete não têm policy: feitos via service_role nas server actions.
