-- supabase/migrations/20260717110000_notification_event_freela_reservada.sql
-- Novo evento: pessoa reservou um freela na própria agenda.
alter type public.notification_event add value if not exists 'freela_reservada';
