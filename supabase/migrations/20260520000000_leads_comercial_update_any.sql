-- Comercial pode atualizar QUALQUER lead (não só os próprios)
--
-- Reclamação: sócio cria card no kanban (comercial_id = sócio.id) e o
-- comercial não consegue editar/mover, mesmo achando que salvou — RLS
-- silenciosamente nega o UPDATE e Supabase retorna error=null (0 rows).
--
-- A regra anterior "comercial atualiza só os próprios leads" não bate com
-- como o time opera: o pipeline é compartilhado, qualquer comercial pode
-- pegar qualquer card. Mantém-se a separação de papéis (assessor, coord
-- continuam restritos), só relaxa o comercial.

drop policy if exists "comercial update own leads" on public.leads;

create policy "comercial update any lead"
  on public.leads for update to authenticated
  using (public.current_user_role() = 'comercial')
  with check (public.current_user_role() = 'comercial');
