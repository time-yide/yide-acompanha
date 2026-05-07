-- supabase/migrations/20260507000046_tasks_update_policy_participantes.sql
-- Permite que participantes adicionais (participantes_ids) também atualizem
-- tasks (necessário pro drag-and-drop no Quadro Kanban e toggle de conclusão).

drop policy if exists "creator or assignee can update task" on public.tasks;

create policy "creator, assignee or participant can update task"
  on public.tasks for update to authenticated
  using (
    criado_por = auth.uid()
    or atribuido_a = auth.uid()
    or auth.uid() = any(participantes_ids)
  )
  with check (
    criado_por = auth.uid()
    or atribuido_a = auth.uid()
    or auth.uid() = any(participantes_ids)
  );
