-- Cargo "Assistente" = união de Coordenador audiovisual + Designer.
--
-- Decisão Yasmin (2026-11-19): as funções isoladas de designer e coordenador
-- audiovisual deixaram de existir. O role `audiovisual_chefe` passa a se chamar
-- "Assistente" no UI (só rótulo, em ROLE_LABELS — o valor no banco continua
-- `audiovisual_chefe`, igual ao `socio` → "Coordenador") e ganha o que era do
-- designer. O role `designer` fica no enum só como legado.
--
-- APLICAR MANUALMENTE no SQL Editor após o merge.

-- 1) Chat: Assistente entra no canal "designers" (mantém a função batendo com
--    CHANNEL_KIND_TO_ROLES em src/lib/escritorio/types.ts). Resto igual à
--    20260803000100_chat_access_financeiro.sql.
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
      'assessor_ecommerce', 'assistente_ecommerce', 'programacao', 'financeiro'
    )
    when 'comercial' then v_role in ('comercial', 'adm', 'socio')
    when 'administrativo' then v_role in ('adm', 'socio')
    when 'assessores_coordenadores' then v_role in ('assessor', 'coordenador', 'adm', 'socio')
    when 'coordenadores_estrategico' then v_role in ('coordenador', 'audiovisual_chefe', 'adm', 'socio')
    when 'audiovisual_geral' then v_role in ('videomaker', 'fast_midia', 'editor', 'audiovisual_chefe', 'adm', 'socio')
    when 'designers' then v_role in ('designer', 'audiovisual_chefe', 'adm', 'socio')
    else false  -- 'direct' e 'grupo' são por member_ids (na policy), não por cargo
  end;
end;
$$ language plpgsql security definer stable;

-- 2) Quem hoje é designer vira Assistente.
--    Comissão zerada de propósito: designer nunca teve % (PRODUCERS zera), mas o
--    calculator dá ao audiovisual_chefe "% sobre a carteira da agência" — sem
--    zerar, um % antigo esquecido viraria comissão sobre a agência inteira.
--    O % de cada Assistente é definido depois, na tela do colaborador.
update public.profiles
   set role = 'audiovisual_chefe',
       comissao_percent = 0,
       comissao_primeiro_mes_percent = 0
 where role = 'designer';
