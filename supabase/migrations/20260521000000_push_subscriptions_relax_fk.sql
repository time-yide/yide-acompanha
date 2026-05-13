-- Permite que client_portal_users (que vivem em auth.users mas NÃO em
-- profiles) salvem subscriptions de Web Push. Antes a FK estreita pra
-- profiles bloqueava — agora aceita qualquer auth.user.
--
-- Backward-compatible: profiles.id é FK pra auth.users.id, então todos
-- os user_id atuais (que apontavam pra profiles) continuam válidos
-- apontando pra auth.users.

alter table public.push_subscriptions
  drop constraint push_subscriptions_user_id_fkey;

alter table public.push_subscriptions
  add constraint push_subscriptions_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
