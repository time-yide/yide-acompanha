-- Adiciona o cargo `programacao` ao canal Geral do Escritório Virtual.
-- O app já libera o canal (CHANNEL_KIND_TO_ROLES em src/lib/escritorio/types.ts),
-- mas sem sincronizar can_access_chat_channel o RLS bloqueia as mensagens →
-- "carrega o canal mas nada aparece". Mantém a função batendo com o TS.
-- programacao entra só em 'geral' (não em comercial/administrativo/audiovisual/designers).

create or replace function public.can_access_chat_channel(
  p_user_id uuid,
  p_channel_kind public.chat_channel_kind
) returns boolean as $$
declare
  v_role text;
begin
  select role::text into v_role from public.profiles where id = p_user_id and ativo = true;
  if v_role is null then return false; end if;

  return case p_channel_kind
    when 'geral' then v_role in (
      'adm', 'socio', 'coordenador', 'assessor', 'comercial', 'designer',
      'videomaker', 'fast_midia', 'editor', 'audiovisual_chefe',
      'assessor_ecommerce', 'assistente_ecommerce', 'programacao'
    )
    when 'comercial' then v_role in ('comercial', 'adm', 'socio')
    when 'administrativo' then v_role in ('adm', 'socio')
    when 'assessores_coordenadores' then v_role in ('assessor', 'coordenador', 'adm', 'socio')
    when 'coordenadores_estrategico' then v_role in ('coordenador', 'audiovisual_chefe', 'adm', 'socio')
    when 'audiovisual_geral' then v_role in ('videomaker', 'fast_midia', 'editor', 'audiovisual_chefe', 'adm', 'socio')
    when 'designers' then v_role in ('designer', 'adm', 'socio')
    else false  -- 'direct' e 'grupo' são por member_ids (na policy), não por cargo
  end;
end;
$$ language plpgsql security definer stable;
