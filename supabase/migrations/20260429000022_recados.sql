-- supabase/migrations/20260429000022_recados.sql

-- =============================================
-- recados
-- =============================================
create table public.recados (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references public.profiles(id) on delete set null,
  autor_role_snapshot text not null,
  titulo text not null check (char_length(titulo) between 1 and 120),
  corpo text not null check (char_length(corpo) between 1 and 2000),
  permanente boolean not null default false,
  arquivado boolean not null default false,
  notif_scope text not null check (notif_scope in ('todos', 'meu_time', 'nenhum')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_recados_feed on public.recados (arquivado, permanente, criado_em desc);
create index idx_recados_autor on public.recados (autor_id);

-- Como a coluna se chama 'atualizado_em' (não 'updated_at'), criamos trigger custom
-- em vez de reusar public.set_updated_at() (que toca 'updated_at').
create or replace function public.set_recados_atualizado_em()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_recados_atualizado_em
  before update on public.recados
  for each row execute function public.set_recados_atualizado_em();

alter table public.recados enable row level security;

create policy "recados select all authenticated"
  on public.recados for select to authenticated using (true);

create policy "recados insert own"
  on public.recados for insert to authenticated
  with check (autor_id = auth.uid());

create policy "recados update author or socio/adm"
  on public.recados for update to authenticated
  using (autor_id = auth.uid() or public.current_user_role() in ('socio', 'adm'))
  with check (autor_id = auth.uid() or public.current_user_role() in ('socio', 'adm'));

create policy "recados delete author or socio/adm"
  on public.recados for delete to authenticated
  using (autor_id = auth.uid() or public.current_user_role() in ('socio', 'adm'));

-- =============================================
-- recado_visualizacoes
-- =============================================
create table public.recado_visualizacoes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

alter table public.recado_visualizacoes enable row level security;

create policy "recado_visualizacoes select own"
  on public.recado_visualizacoes for select to authenticated
  using (user_id = auth.uid());

create policy "recado_visualizacoes upsert own"
  on public.recado_visualizacoes for insert to authenticated
  with check (user_id = auth.uid());

create policy "recado_visualizacoes update own"
  on public.recado_visualizacoes for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- =============================================
-- recado_reacoes
-- =============================================
create table public.recado_reacoes (
  recado_id uuid not null references public.recados(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('👍', '❤️', '✅', '🎉')),
  criado_em timestamptz not null default now(),
  primary key (recado_id, user_id, emoji)
);

create index idx_recado_reacoes_recado on public.recado_reacoes (recado_id);

alter table public.recado_reacoes enable row level security;

create policy "recado_reacoes select all authenticated"
  on public.recado_reacoes for select to authenticated using (true);

create policy "recado_reacoes insert own"
  on public.recado_reacoes for insert to authenticated
  with check (user_id = auth.uid());

create policy "recado_reacoes delete own"
  on public.recado_reacoes for delete to authenticated
  using (user_id = auth.uid());

-- =============================================
-- recados_team_member_ids: resolve "meu time" por papel do autor
-- =============================================
create or replace function public.recados_team_member_ids(autor uuid)
returns setof uuid
language plpgsql
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
      where c.coordenador_id = autor and c.assessor_id is not null and c.assessor_id <> autor;
    return;
  end if;

  if papel = 'assessor' then
    return query
      with meus_coords as (
        select distinct c.coordenador_id from public.clients c
        where c.assessor_id = autor and c.coordenador_id is not null
      )
      select coordenador_id from meus_coords
      union
      select distinct c2.assessor_id from public.clients c2
      where c2.coordenador_id in (select coordenador_id from meus_coords)
        and c2.assessor_id is not null and c2.assessor_id <> autor;
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

grant execute on function public.recados_team_member_ids(uuid) to authenticated;

-- notification_event seed moved to 20260429000023_recados_notification_event.sql
-- notification_rules seed moved to 20260429000024_recados_notification_rules_seed.sql
