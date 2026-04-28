-- supabase/migrations/20260428000020_notification_event_painel.sql

alter type public.notification_event add value if not exists 'checklist_step_delegada';
alter type public.notification_event add value if not exists 'checklist_step_atrasada';
alter type public.notification_event add value if not exists 'checklist_step_concluida';
