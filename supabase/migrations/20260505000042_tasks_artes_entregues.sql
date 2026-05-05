-- supabase/migrations/20260505000042_tasks_artes_entregues.sql
-- Campo opcional preenchido pelo designer ao concluir uma tarefa.
-- Nullable por design: tarefas concluídas por outros roles ou tarefas
-- antigas (anteriores a esta migration) ficam null.

alter table public.tasks
  add column if not exists artes_entregues integer null
  check (artes_entregues is null or artes_entregues >= 0);
