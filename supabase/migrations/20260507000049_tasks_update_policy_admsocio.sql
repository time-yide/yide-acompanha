-- supabase/migrations/20260507000049_tasks_update_policy_admsocio.sql
-- Estende a RLS policy de UPDATE em tasks pra incluir adm e sócio,
-- permitindo que arrastem qualquer card no Kanban (e usem ações de
-- aprovação/postagem) mesmo sem estar vinculados à tarefa.

drop policy if exists "creator, assignee or participant can update task" on public.tasks;

create policy "creator, assignee, participant or adm/socio can update task"
  on public.tasks for update to authenticated
  using (
    criado_por = auth.uid()
    or atribuido_a = auth.uid()
    or auth.uid() = any(participantes_ids)
    or public.current_user_role() in ('adm', 'socio')
  )
  with check (
    criado_por = auth.uid()
    or atribuido_a = auth.uid()
    or auth.uid() = any(participantes_ids)
    or public.current_user_role() in ('adm', 'socio')
  );
