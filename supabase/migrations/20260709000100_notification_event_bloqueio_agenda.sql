-- supabase/migrations/20260709000100_notification_event_bloqueio_agenda.sql
-- Novos eventos de notificação pro fluxo de bloqueio de agenda do videomaker.
alter type public.notification_event add value if not exists 'bloqueio_agenda_solicitado';
alter type public.notification_event add value if not exists 'bloqueio_agenda_respondido';
