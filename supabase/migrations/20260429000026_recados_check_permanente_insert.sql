-- supabase/migrations/20260429000026_recados_check_permanente_insert.sql
-- Final-review followup: trigger só guardava UPDATE; agora também guarda INSERT
-- contra cliente PostgREST direto criando recado com permanente=true.

create or replace function public.recados_check_permanente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.permanente = true and public.current_user_role() <> 'socio' then
      raise exception 'Apenas Sócio pode criar recados permanentes';
    end if;
    return new;
  end if;

  -- UPDATE
  if new.permanente is distinct from old.permanente
     and public.current_user_role() <> 'socio' then
    raise exception 'Apenas Sócio pode alterar o campo permanente';
  end if;
  return new;
end;
$$;

create trigger trg_recados_check_permanente_insert
  before insert on public.recados
  for each row execute function public.recados_check_permanente();
