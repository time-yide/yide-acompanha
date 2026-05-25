-- BUG FIX: criar colaborador falhava com "Database error creating new user".
--
-- O PR #347 (multi-tenant Fase 1, migration 20260601000000_units_fase1.sql)
-- adicionou `profiles.unit_id NOT NULL`, mas não atualizou o trigger
-- `handle_new_user()`. Quando o sócio chamava `auth.admin.createUser`, o
-- trigger inseria em `profiles` sem `unit_id` → violava NOT NULL → Supabase
-- devolvia o erro genérico "Database error creating new user".
--
-- Fix: trigger passa a setar `unit_id` no INSERT, usando como default a
-- primeira unidade ativa (na prática, Matriz — única unidade ativa no
-- ambiente atual). A server action ainda faz UPDATE depois pra colocar o
-- colaborador na unidade ATIVA do criador (cookie de master), então este
-- default é só pra o INSERT não quebrar.

create or replace function public.handle_new_user()
returns trigger as $$
declare
  org_id uuid;
  user_role public.user_role;
  user_nome text;
  default_unit_id uuid;
begin
  -- Pula client portal users — eles vivem em client_portal_users, não profiles.
  if (new.raw_user_meta_data ->> 'kind') = 'client_portal' then
    return new;
  end if;

  -- Pega a única organização (single-tenant)
  select id into org_id from public.organizations limit 1;

  -- Default da unidade: primeira ativa (Matriz no ambiente atual).
  -- Não é critical-path porque a server action faz UPDATE em seguida pra
  -- usar a unidade ativa do criador. Mas precisa de algo NOT NULL aqui.
  select id into default_unit_id
  from public.units
  where ativa = true
  order by created_at asc
  limit 1;

  -- Lê role e nome dos metadados do convite (passados em raw_user_meta_data)
  user_role := coalesce(
    (new.raw_user_meta_data ->> 'role')::public.user_role,
    'assessor'::public.user_role
  );
  user_nome := coalesce(
    new.raw_user_meta_data ->> 'nome',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, organization_id, role, nome, email, unit_id)
  values (new.id, org_id, user_role, user_nome, new.email, default_unit_id);

  return new;
end;
$$ language plpgsql security definer set search_path = public;
