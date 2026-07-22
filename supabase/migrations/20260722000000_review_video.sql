-- Frame Interno (Fase A). Aplicação MANUAL no SQL Editor após o merge.
create type public.review_status as enum ('revisao_interna', 'revisao_cliente', 'ajustes', 'aprovado');
create type public.review_autor_tipo as enum ('time', 'cliente');

create table public.review_video (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  cliente_id uuid references public.clients(id),
  titulo text not null,
  status public.review_status not null default 'revisao_interna',
  criado_por uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index review_video_cliente_idx on public.review_video(cliente_id);
create index review_video_status_idx on public.review_video(status);

create table public.review_versao (
  id uuid primary key default gen_random_uuid(),
  review_video_id uuid not null references public.review_video(id) on delete cascade,
  numero int not null,
  bunny_video_id text not null,
  pronto boolean not null default false,
  duracao_seg int,
  criado_por uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (review_video_id, numero)
);
create index review_versao_review_idx on public.review_versao(review_video_id);

create table public.review_comentario (
  id uuid primary key default gen_random_uuid(),
  versao_id uuid not null references public.review_versao(id) on delete cascade,
  autor_tipo public.review_autor_tipo not null,
  autor_id uuid references public.profiles(id),
  autor_nome text not null,
  tempo_seg int not null default 0,
  corpo text not null,
  resolvido boolean not null default false,
  created_at timestamptz not null default now()
);
create index review_comentario_versao_idx on public.review_comentario(versao_id);

alter table public.review_video enable row level security;
alter table public.review_versao enable row level security;
alter table public.review_comentario enable row level security;
create policy review_video_read on public.review_video for select to authenticated using (true);
create policy review_versao_read on public.review_versao for select to authenticated using (true);
create policy review_comentario_read on public.review_comentario for select to authenticated using (true);
