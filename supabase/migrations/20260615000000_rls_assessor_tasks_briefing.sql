-- supabase/migrations/20260615000000_rls_assessor_tasks_briefing.sql
-- Corrige duas RLS que estavam dessincronizadas da lógica de permissão do app,
-- causando falha silenciosa pra assessor (UPDATE/INSERT negado = 0 linhas):
--
--  1) tasks UPDATE: o código (canManageAnyTask em src/lib/tarefas/actions.ts)
--     deixa adm/socio/coordenador/assessor/audiovisual_chefe gerenciarem
--     qualquer tarefa, mas a RLS só permitia adm/socio (+ criador/atribuído/
--     participante). Resultado: assessor não conseguia arrastar card no kanban
--     (ex.: "Concluído Operacional" -> "Postado/Entregue").
--
--  2) client_briefing INSERT: o UPDATE já permite o assessor/coordenador DO
--     CLIENTE editar, mas o INSERT só permitia adm/socio. No 1º save (briefing
--     ainda não existe) o upsert vira INSERT e era bloqueado -> "Sem permissão".

-- =============================================
-- 1) tasks UPDATE: espelha canManageAnyTask
-- =============================================
drop policy if exists "creator, assignee, participant or adm/socio can update task" on public.tasks;

create policy "creator, assignee, participant or gestao can update task"
  on public.tasks for update to authenticated
  using (
    criado_por = auth.uid()
    or atribuido_a = auth.uid()
    or auth.uid() = any(participantes_ids)
    or public.current_user_role() in ('adm', 'socio', 'coordenador', 'assessor', 'audiovisual_chefe')
  )
  with check (
    criado_por = auth.uid()
    or atribuido_a = auth.uid()
    or auth.uid() = any(participantes_ids)
    or public.current_user_role() in ('adm', 'socio', 'coordenador', 'assessor', 'audiovisual_chefe')
  );

-- =============================================
-- 2) client_briefing INSERT: mesmo escopo do UPDATE
--    (adm/socio OU assessor/coordenador do cliente)
-- =============================================
drop policy if exists "adm/socio insert briefing" on public.client_briefing;

create policy "adm/socio or own-client edit insert briefing"
  on public.client_briefing for insert to authenticated
  with check (
    public.current_user_role() in ('adm', 'socio')
    or exists (
      select 1 from public.clients c
      where c.id = client_briefing.client_id
        and (c.assessor_id = auth.uid() or c.coordenador_id = auth.uid())
    )
  );
