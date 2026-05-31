-- supabase/migrations/20260618000200_notification_event_freela.sql
-- Novo evento de notificação: nova oportunidade no Freelayide.
alter type public.notification_event add value if not exists 'freela_nova_oportunidade';
