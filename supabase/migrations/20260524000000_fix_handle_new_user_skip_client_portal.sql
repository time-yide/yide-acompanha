-- supabase/migrations/20260524000000_fix_handle_new_user_skip_client_portal.sql
--
-- BUG FIX: Quando uma conta de portal do cliente era criada (auth.user com
-- raw_user_meta_data->>'kind' = 'client_portal'), o trigger handle_new_user
-- também inseria uma linha em public.profiles com role default 'assessor'.
-- Isso fazia o cliente final aparecer como colaborador interno na página
-- /colaboradores e nos dropdowns de atribuição de tarefa.
--
-- Fix:
--   1. Trigger pula a criação de profile quando kind='client_portal'.
--      Esses users são tracked SOMENTE em public.client_portal_users.
--   2. Marca como inativos os profiles fantasma existentes (todos cujo id
--      bate com client_portal_users.user_id). Não usa DELETE pra evitar
--      problema com eventuais FKs — basta sair dos filtros (.eq("ativo", true)).

create or replace function public.handle_new_user()
returns trigger as $$
declare
  org_id uuid;
  user_role public.user_role;
  user_nome text;
begin
  -- Pula client portal users — eles vivem em client_portal_users, não profiles.
  if (new.raw_user_meta_data ->> 'kind') = 'client_portal' then
    return new;
  end if;

  -- Pega a única organização (single-tenant)
  select id into org_id from public.organizations limit 1;

  -- Lê role e nome dos metadados do convite (passados em raw_user_meta_data)
  user_role := coalesce(
    (new.raw_user_meta_data ->> 'role')::public.user_role,
    'assessor'::public.user_role
  );
  user_nome := coalesce(
    new.raw_user_meta_data ->> 'nome',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, organization_id, role, nome, email)
  values (new.id, org_id, user_role, user_nome, new.email);

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Cleanup: marca como inativos todos os profiles fantasma que foram criados
-- automaticamente pra usuários de portal do cliente. Não deleta pra preservar
-- eventuais FKs (tasks/recados/etc) — mas filtros que usam .eq("ativo", true)
-- (que é a maioria) deixam de mostrar.
update public.profiles
set ativo = false, updated_at = now()
where id in (select user_id from public.client_portal_users)
  and ativo = true;
