-- Conquistas do Card do Jogador (Fase 2). Aplicação MANUAL no SQL Editor após o merge.
create table public.conquista_desbloqueada (
  user_id uuid not null references public.profiles(id) on delete cascade,
  conquista_key text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, conquista_key)
);
create index conquista_desbloqueada_user_idx on public.conquista_desbloqueada(user_id);

alter table public.conquista_desbloqueada enable row level security;
create policy conquista_desbloqueada_read on public.conquista_desbloqueada
  for select to authenticated using (true);
