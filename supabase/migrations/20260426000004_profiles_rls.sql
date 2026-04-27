-- supabase/migrations/20260426000004_profiles_rls.sql
alter table public.profiles enable row level security;

-- Helper function: pega role do usuário logado
create or replace function public.current_user_role()
returns public.user_role as $$
  select role from public.profiles where id = auth.uid();
$$ language sql stable security definer set search_path = public;

-- 1. Qualquer autenticado vê SEU PRÓPRIO perfil
create policy "authenticated can view own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- 2. ADM e Sócio veem TODOS os perfis
create policy "adm/socio can view all profiles"
  on public.profiles for select
  to authenticated
  using (public.current_user_role() in ('adm', 'socio'));

-- 3. Outros papéis (coord, assessor, comercial) veem perfis básicos da equipe
create policy "team members can view active colleagues basic info"
  on public.profiles for select
  to authenticated
  using (ativo = true);

-- 4. Usuário pode atualizar SEU PRÓPRIO perfil em campos não-sensíveis
create policy "user can update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- 5. ADM e Sócio podem atualizar qualquer perfil
create policy "adm/socio can update any profile"
  on public.profiles for update
  to authenticated
  using (public.current_user_role() in ('adm', 'socio'))
  with check (public.current_user_role() in ('adm', 'socio'));

-- 6. ADM e Sócio podem inserir perfis
create policy "adm/socio can insert profiles"
  on public.profiles for insert
  to authenticated
  with check (public.current_user_role() in ('adm', 'socio'));

-- Não há policy de DELETE — desativação é via flag ativo=false
