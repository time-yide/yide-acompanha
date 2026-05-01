-- supabase/migrations/20260429000023_recados_notification_event.sql

alter type public.notification_event add value if not exists 'recado_novo';
