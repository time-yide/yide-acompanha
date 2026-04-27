-- supabase/migrations/20260427000009_notifications_policy_tighten.sql
-- Restrict the UPDATE policy on notifications: users can only flip `lida` to true.
-- Other columns (tipo, titulo, mensagem, link, user_id) are system-generated and immutable.

drop policy "users mark own notifications as read" on public.notifications;

create policy "users mark own notifications as read"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and lida = true
  );
