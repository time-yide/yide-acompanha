-- supabase/migrations/20260710000200_social_media_reels_cover.sql
-- Capa do Reels: imagem própria (cover_url) OU um frame do vídeo (thumb_offset em ms).
alter table public.social_media_posts
  add column if not exists reels_cover_url text,
  add column if not exists reels_thumb_offset integer;
