-- Atualiza RLS DELETE policy de audiovisual_capturas pra incluir
-- audiovisual_chefe e coordenador (alinhamento com a action
-- deleteCapturaAction que permite esses roles).
--
-- Antes: só socio + adm conseguiam deletar.
-- Depois: socio + adm + audiovisual_chefe + coordenador.
--
-- Bug que motivou: PR #204 adicionou botão "Excluir" pros 4 roles, mas
-- a policy antiga silenciosamente rejeitava o DELETE pra audiovisual_chefe
-- e coordenador — UI mostrava "Captação excluída" via toast mas o registro
-- não sumia do banco.

drop policy if exists "audiovisual_capturas delete" on public.audiovisual_capturas;

create policy "audiovisual_capturas delete"
  on public.audiovisual_capturas for delete to authenticated
  using (public.current_user_role() in ('socio', 'adm', 'audiovisual_chefe', 'coordenador'));
