-- Conquistas/medalhas do FreelaYide: registra o momento de desbloqueio por pessoa.
create table if not exists public.freela_conquistas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  conquista_key text not null,
  unlocked_at timestamptz not null default now(),
  unique (user_id, conquista_key)
);

create index if not exists freela_conquistas_user_idx on public.freela_conquistas (user_id);

alter table public.freela_conquistas enable row level security;

-- Cada pessoa lê só as próprias. Escrita é feita via service-role (verificador), que bypassa RLS.
drop policy if exists "freela_conquistas_select_own" on public.freela_conquistas;
create policy "freela_conquistas_select_own" on public.freela_conquistas
  for select using (user_id = auth.uid());
