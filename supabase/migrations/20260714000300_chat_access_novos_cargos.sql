-- Sincroniza can_access_chat_channel (RLS de mensagens) com os cargos do app.
-- A função foi escrita antes de fast_midia / assessor_ecommerce /
-- assistente_ecommerce existirem, então esses cargos VIAM o canal (check do
-- app via CHANNEL_KIND_TO_ROLES) mas o RLS bloqueava as mensagens → "não
-- carrega". Aqui a função passa a bater exatamente com CHANNEL_KIND_TO_ROLES
-- em src/lib/escritorio/types.ts.

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
      'assessor_ecommerce', 'assistente_ecommerce'
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
