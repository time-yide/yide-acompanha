-- supabase/migrations/20260428000018_clients_painel_fields.sql

alter table public.clients
  add column if not exists designer_id uuid references public.profiles(id),
  add column if not exists videomaker_id uuid references public.profiles(id),
  add column if not exists editor_id uuid references public.profiles(id),
  add column if not exists instagram_url text,
  add column if not exists gmn_url text,
  add column if not exists drive_url text,
  add column if not exists pacote_post_padrao integer;

create index if not exists idx_clients_designer on public.clients(designer_id) where designer_id is not null;
create index if not exists idx_clients_videomaker on public.clients(videomaker_id) where videomaker_id is not null;
create index if not exists idx_clients_editor on public.clients(editor_id) where editor_id is not null;
