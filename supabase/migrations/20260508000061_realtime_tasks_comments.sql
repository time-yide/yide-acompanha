-- Habilita Realtime nas tabelas que precisam de updates ao vivo:
-- - task_comments: novos comentários aparecem na hora pros envolvidos
-- - tasks: mudanças de status/atribuição/prioridade refletem ao vivo
-- A auth do websocket é feita no cliente via supabase.realtime.setAuth()
-- (ver src/lib/supabase/realtime-auth.ts) — RLS já existente filtra
-- quem pode ver o quê.

alter publication supabase_realtime add table public.task_comments;
alter publication supabase_realtime add table public.tasks;
