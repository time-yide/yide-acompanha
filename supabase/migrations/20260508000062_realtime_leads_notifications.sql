-- Habilita Realtime nas tabelas que faltavam pra cobrir as outras páginas:
-- - leads: kanban de onboarding atualiza ao vivo quando comercial move card
-- - notifications: sino de notificações atualiza badge sem polling
-- (chat_messages, task_comments e tasks já estão na publication via
-- migrations anteriores — 20260508000054 e 20260508000061)

alter publication supabase_realtime add table public.leads;
alter publication supabase_realtime add table public.notifications;
