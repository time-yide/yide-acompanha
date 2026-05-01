-- supabase/migrations/20260429000025_recados_fixes.sql
-- Fixes from code review of Task 1.

-- =============================================
-- Fix 1: drop NOT NULL on autor_id
-- (FK already uses ON DELETE SET NULL; NOT NULL was contradictory.)
-- =============================================
alter table public.recados alter column autor_id drop not null;

-- =============================================
-- Fix 2: column-level guard — apenas Sócio altera 'permanente'
-- =============================================
create or replace function public.recados_check_permanente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.permanente is distinct from old.permanente
     and public.current_user_role() <> 'socio' then
    raise exception 'Apenas Sócio pode alterar o campo permanente';
  end if;
  return new;
end;
$$;

create trigger trg_recados_check_permanente
  before update on public.recados
  for each row execute function public.recados_check_permanente();

-- =============================================
-- Fix 3: recados_team_member_ids — filtrar ativo=true em todos os branches
-- e marcar função como STABLE
-- =============================================
create or replace function public.recados_team_member_ids(autor uuid)
returns setof uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  papel text;
begin
  select p.role::text into papel from public.profiles p where p.id = autor;
  if papel is null then
    return;
  end if;

  if papel in ('socio', 'adm') then
    return query
      select id from public.profiles
      where ativo = true and id <> autor;
    return;
  end if;

  if papel = 'coordenador' then
    return query
      select distinct c.assessor_id from public.clients c
      join public.profiles p on p.id = c.assessor_id
      where c.coordenador_id = autor
        and c.assessor_id is not null
        and c.assessor_id <> autor
        and p.ativo = true;
    return;
  end if;

  if papel = 'assessor' then
    return query
      with meus_coords as (
        select distinct c.coordenador_id from public.clients c
        where c.assessor_id = autor and c.coordenador_id is not null
      )
      select coord.id
      from meus_coords mc
      join public.profiles coord on coord.id = mc.coordenador_id
      where coord.ativo = true
      union
      select distinct c2.assessor_id from public.clients c2
      join public.profiles ap on ap.id = c2.assessor_id
      where c2.coordenador_id in (select coordenador_id from meus_coords)
        and c2.assessor_id is not null
        and c2.assessor_id <> autor
        and ap.ativo = true;
    return;
  end if;

  if papel = 'comercial' then
    return query
      select id from public.profiles
      where ativo = true and role::text = 'comercial' and id <> autor;
    return;
  end if;

  if papel in ('audiovisual_chefe', 'videomaker', 'designer', 'editor') then
    return query
      select id from public.profiles
      where ativo = true
        and role::text in ('audiovisual_chefe', 'videomaker', 'designer', 'editor')
        and id <> autor;
    return;
  end if;
end;
$$;

-- =============================================
-- Fix 4: drop redundant index (PK leftmost-prefix already serves recado_id queries)
-- =============================================
drop index if exists public.idx_recado_reacoes_recado;
