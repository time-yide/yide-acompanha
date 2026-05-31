-- supabase/migrations/20260618000400_notifications_prioridade.sql
-- Prioridade da notificação. 'urgente' dispara cor/som diferenciados no app
-- e vibração/requireInteraction no push.
alter table public.notifications
  add column if not exists prioridade text not null default 'normal'
    check (prioridade in ('normal', 'urgente'));
