-- Card do Jogador (Fase 1) — perfil social/gamificado, isolado dos dados de RH.
-- Aplicação MANUAL no SQL Editor após o merge (Vercel não roda migration no deploy).

create table public.perfil_jogador (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  username text unique,
  capa_url text,
  bio text,
  como_trabalho text,
  hobbies text[] not null default '{}',
  frase text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- username único case-insensitive (permite null enquanto não definido)
create unique index perfil_jogador_username_lower_idx
  on public.perfil_jogador (lower(username))
  where username is not null;

-- RLS: leitura pra qualquer autenticado (como os demais recursos internos).
-- Escrita roda via service-role no server action, com checagem no código.
alter table public.perfil_jogador enable row level security;
create policy perfil_jogador_read on public.perfil_jogador
  for select to authenticated using (true);
