-- supabase/migrations/20260615000001_escritorio_canal_soft_delete.sql
-- Soft delete de canais fixos do Escritório (DMs continuam hard delete).
alter table public.chat_channels
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id);

create index if not exists idx_chat_channels_deleted_at
  on public.chat_channels (deleted_at) where deleted_at is not null;
