-- supabase/migrations/20260426000003_profile_trigger.sql
create or replace function public.handle_new_user()
returns trigger as $$
declare
  org_id uuid;
  user_role public.user_role;
  user_nome text;
begin
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
