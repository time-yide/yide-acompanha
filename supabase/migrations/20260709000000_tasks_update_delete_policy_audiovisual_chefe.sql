-- supabase/migrations/20260709000000_tasks_update_delete_policy_audiovisual_chefe.sql
-- Estende as RLS policies de UPDATE e DELETE em tasks pra incluir o
-- coordenador do audiovisual (audiovisual_chefe), permitindo que ele
-- ajuste (responsável, prazo, links etc.) e exclua qualquer tarefa,
-- independentemente de quem criou.
--
-- O app-layer (isPrivileged / canManageAnyTask em src/lib/tarefas/actions.ts
-- e o gate de UI em src/app/(authed)/tarefas/[id]/page.tsx) já libera
-- audiovisual_chefe; sem esta migration o RLS bloqueia silenciosamente
-- o UPDATE (error:null, 0 rows) e o DELETE.

-- UPDATE
drop policy if exists "creator, assignee, participant or adm/socio can update task" on public.tasks;

create policy "creator, assignee, participant, adm/socio or audiovisual_chefe can update task"
  on public.tasks for update to authenticated
  using (
    criado_por = auth.uid()
    or atribuido_a = auth.uid()
    or auth.uid() = any(participantes_ids)
    or public.current_user_role() in ('adm', 'socio', 'audiovisual_chefe')
  )
  with check (
    criado_por = auth.uid()
    or atribuido_a = auth.uid()
    or auth.uid() = any(participantes_ids)
    or public.current_user_role() in ('adm', 'socio', 'audiovisual_chefe')
  );

-- DELETE
drop policy if exists "creator or adm/socio can delete task" on public.tasks;

create policy "creator, adm/socio or audiovisual_chefe can delete task"
  on public.tasks for delete to authenticated
  using (
    criado_por = auth.uid()
    or public.current_user_role() in ('adm', 'socio', 'audiovisual_chefe')
  );
