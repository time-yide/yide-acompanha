-- supabase/migrations/20260614000000_recados_privados.sql
-- Recados privados (direcionados): coluna privado + tabela de destinatarios + RLS.

-- 1) Coluna privado em recados
alter table public.recados
  add column if not exists privado boolean not null default false;

create index if not exists idx_recados_privado
  on public.recados (privado, arquivado, criado_em desc);

-- 2) Destinatarios
create table if not exists public.recado_destinatarios (
  recado_id uuid not null references public.recados(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  lido_em   timestamptz null,
  criado_em timestamptz not null default now(),
  primary key (recado_id, user_id)
);

create index if not exists idx_recado_dest_user
  on public.recado_destinatarios (user_id, lido_em);
create index if not exists idx_recado_dest_recado
  on public.recado_destinatarios (recado_id);

-- 3) Funcoes security definer para quebrar recursao de RLS entre
--    recados <-> recado_destinatarios.
create or replace function public.recado_is_destinatario(p_recado uuid, p_user uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.recado_destinatarios d
    where d.recado_id = p_recado and d.user_id = p_user
  );
$$;

create or replace function public.recado_autor_is(p_recado uuid, p_user uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.recados r
    where r.id = p_recado and r.autor_id = p_user
  );
$$;

grant execute on function public.recado_is_destinatario(uuid, uuid) to authenticated;
grant execute on function public.recado_autor_is(uuid, uuid) to authenticated;

-- 4) RLS recados: aperta SELECT (era using(true))
drop policy if exists "recados select all authenticated" on public.recados;

create policy "recados select visible"
  on public.recados for select to authenticated
  using (
    privado = false
    or autor_id = auth.uid()
    or public.current_user_role() = 'socio'
    or public.recado_is_destinatario(id, auth.uid())
  );

-- 5) RLS recado_destinatarios
alter table public.recado_destinatarios enable row level security;

create policy "recado_dest select visible"
  on public.recado_destinatarios for select to authenticated
  using (
    user_id = auth.uid()
    or public.current_user_role() = 'socio'
    or public.recado_autor_is(recado_id, auth.uid())
  );

create policy "recado_dest insert by author"
  on public.recado_destinatarios for insert to authenticated
  with check (public.recado_autor_is(recado_id, auth.uid()));

create policy "recado_dest update own lido"
  on public.recado_destinatarios for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "recado_dest delete by author"
  on public.recado_destinatarios for delete to authenticated
  using (public.recado_autor_is(recado_id, auth.uid()));
