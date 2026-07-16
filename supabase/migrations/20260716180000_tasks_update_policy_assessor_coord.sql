-- Alinha a RLS de UPDATE de tasks com canManageAnyTask (app): assessor e
-- coordenador também gerenciam cards que não são deles ("gestão operacional" -
-- coordenam entregas). Antes a policy só tinha adm/socio/audiovisual_chefe, e o
-- update de assessor/coordenador em card de terceiro era bloqueado em SILÊNCIO
-- (0 linhas, sem erro) → "mandar card pra postado e nada acontece".
drop policy if exists "creator, assignee, participant, adm/socio or audiovisual_chefe " on public.tasks;
drop policy if exists "creator, assignee, participant or adm/socio" on public.tasks;

create policy "task update: members or gestao operacional"
  on public.tasks for update to authenticated
  using (
    criado_por = auth.uid()
    or atribuido_a = auth.uid()
    or auth.uid() = any(participantes_ids)
    or public.current_user_role() = any (array['adm','socio','coordenador','assessor','audiovisual_chefe']::public.user_role[])
  )
  with check (
    criado_por = auth.uid()
    or atribuido_a = auth.uid()
    or auth.uid() = any(participantes_ids)
    or public.current_user_role() = any (array['adm','socio','coordenador','assessor','audiovisual_chefe']::public.user_role[])
  );
