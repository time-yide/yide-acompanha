-- Painel Mensal: faltavam as policies de INSERT em client_monthly_checklist e
-- checklist_step. Com RLS ligada e sem policy de INSERT, o Postgres nega todo
-- INSERT feito pelo usuário logado (assessor). As leituras funcionam (rodam via
-- service-role), mas os fluxos de escrita do redesign inserem linhas COMO o
-- assessor:
--   - uploadCronogramaAction: upsert em client_monthly_checklist (INSERT quando
--     o cliente ainda não tem linha do mês) -> "não consegue colocar link".
--   - markStepProntoAction: upsert em checklist_step pra criar a PRÓXIMA etapa
--     (INSERT) -> "não consegue marcar o painel".
--
-- As policies abaixo espelham as de UPDATE já existentes (time do cliente ou
-- papel privilegiado), então o assessor só insere linhas dos SEUS clientes.

-- client_monthly_checklist: INSERT pelo time do cliente ou privilegiado.
drop policy if exists "checklist insert by team" on public.client_monthly_checklist;
create policy "checklist insert by team"
  on public.client_monthly_checklist for insert to authenticated
  with check (
    public.current_user_role() in ('socio', 'adm', 'coordenador') OR
    exists (
      select 1 from public.clients c
      where c.id = client_id AND (
        c.assessor_id = auth.uid() OR
        c.coordenador_id = auth.uid() OR
        c.designer_id = auth.uid() OR
        c.videomaker_id = auth.uid() OR
        c.editor_id = auth.uid()
      )
    )
  );

-- checklist_step: INSERT pelo responsável, time do cliente ou privilegiado.
-- Precisa cobrir o time todo porque a cadeia entrega a próxima etapa a OUTRA
-- pessoa (ex.: assessor conclui cronograma -> próxima etapa é design do
-- designer), então quem insere nem sempre é o responsavel_id da linha nova.
drop policy if exists "step insert by team" on public.checklist_step;
create policy "step insert by team"
  on public.checklist_step for insert to authenticated
  with check (
    public.current_user_role() in ('socio', 'adm', 'coordenador') OR
    responsavel_id = auth.uid() OR
    exists (
      select 1 from public.client_monthly_checklist cmc
      join public.clients c on c.id = cmc.client_id
      where cmc.id = checklist_id AND (
        c.assessor_id = auth.uid() OR
        c.coordenador_id = auth.uid() OR
        c.designer_id = auth.uid() OR
        c.videomaker_id = auth.uid() OR
        c.editor_id = auth.uid()
      )
    )
  );
