-- supabase/migrations/20260508000056_escritorio_canais_extras_seed.sql
-- Atualiza a função can_access_chat_channel pra cobrir os 3 novos kinds e
-- insere os canais correspondentes.

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
    when 'geral' then v_role in ('adm', 'socio', 'coordenador', 'assessor', 'comercial', 'designer', 'videomaker', 'editor', 'audiovisual_chefe')
    when 'comercial' then v_role in ('comercial', 'adm', 'socio')
    when 'administrativo' then v_role in ('adm', 'socio')
    when 'assessores_coordenadores' then v_role in ('assessor', 'coordenador', 'adm', 'socio')
    when 'coordenadores_estrategico' then v_role in ('coordenador', 'audiovisual_chefe', 'adm', 'socio')
    when 'audiovisual_geral' then v_role in ('videomaker', 'editor', 'audiovisual_chefe', 'adm', 'socio')
    when 'designers' then v_role in ('designer', 'adm', 'socio')
    else false
  end;
end;
$$ language plpgsql security definer stable;

-- Insere os 3 canais novos (Geral primeiro na ordem visual).
insert into public.chat_channels (kind, nome, descricao, ordem) values
  ('geral', 'Geral',
    'Canal aberto a todo o escritório — comunicados, novidades, conversas que envolvem todos.', 0),
  ('comercial', 'Comercial',
    'Canal exclusivo do time comercial — alinhamentos de vendas, leads, fechamentos.', 5),
  ('administrativo', 'Administrativo',
    'Canal restrito a adm e sócio — gestão administrativa e decisões internas.', 6)
on conflict (kind) do nothing;
