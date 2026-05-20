-- Multi-tenant Fase 3 (escritório): chat_channels passam a ter unit_id, com
-- 1 set de canais role-based por unidade. DMs (kind='direct') continuam
-- cross-unit (mantêm unit_id NULL).
--
-- Antes desse PR existia exatamente 1 "Geral", 1 "Audiovisual", etc no banco
-- todo — quando a sócia trocava pra ver Salvador via UnitSwitcher, o chat
-- mostrava conversas misturadas das duas unidades. Agora cada unidade tem
-- seu próprio set de canais.

-- 1) Adiciona coluna unit_id (nullable inicialmente pra backfill)
alter table public.chat_channels
  add column if not exists unit_id uuid references public.units(id) on delete restrict;

-- 2) Backfill: todo canal NÃO-direct vai pra Matriz
update public.chat_channels
  set unit_id = (select id from public.units where slug = 'matriz' limit 1)
  where kind <> 'direct' and unit_id is null;

-- 3) Drop o UNIQUE antigo em (kind) sozinho. Nome do constraint pode variar
--    entre ambientes — usa try/catch.
do $$
begin
  alter table public.chat_channels drop constraint chat_channels_kind_key;
exception when undefined_object then
  null;
end $$;

-- 4) UNIQUE parcial (kind, unit_id) pra canais não-DM. DMs identificam pelo
--    par member_ids (índice existente em 20260508140100).
create unique index if not exists idx_chat_channels_kind_unit_unique
  on public.chat_channels (kind, unit_id)
  where kind <> 'direct';

-- 5) Constraint: canal não-DM exige unit_id; DM exige unit_id NULL.
alter table public.chat_channels
  add constraint chat_channels_unit_id_consistency
  check (
    (kind = 'direct' and unit_id is null)
    or (kind <> 'direct' and unit_id is not null)
  );

-- 6) Função pra seed de canais — usada agora pelas unidades existentes e
--    chamada da `createUnitAction` quando uma unidade nova é criada.
create or replace function public.seed_chat_channels_for_unit(p_unit_id uuid)
returns void as $$
declare
  matriz_id uuid := (select id from public.units where slug = 'matriz' limit 1);
  ch record;
begin
  if matriz_id is null then
    raise notice '[seed_chat_channels_for_unit] matriz não encontrada — skip';
    return;
  end if;
  if p_unit_id = matriz_id then return; end if;

  for ch in
    select kind, nome, descricao, ordem
    from public.chat_channels
    where kind <> 'direct' and unit_id = matriz_id
  loop
    insert into public.chat_channels (kind, nome, descricao, ordem, unit_id)
    values (ch.kind, ch.nome, ch.descricao, ch.ordem, p_unit_id)
    on conflict do nothing;
  end loop;
end;
$$ language plpgsql security definer;

-- 6b) Aplica pra todas as unidades não-Matriz já existentes.
do $$
declare
  unit_rec record;
begin
  for unit_rec in
    select id from public.units where ativa = true and slug <> 'matriz'
  loop
    perform public.seed_chat_channels_for_unit(unit_rec.id);
  end loop;
end $$;

-- 7) Índice de leitura pra filtragem por unidade
create index if not exists idx_chat_channels_unit on public.chat_channels(unit_id)
  where kind <> 'direct';

comment on column public.chat_channels.unit_id is
  'Unidade dona do canal. NULL apenas pra kind=direct (DMs cross-unit). '
  'Demais canais (role-based) têm 1 instância por unidade.';
