-- Campos pra rastrear publicação real no Meta (Instagram/Facebook).
-- Vai ser preenchido pelo cron `/api/cron/social-media-publish` quando o
-- post for de fato publicado via Graph API usando System User Token da BM Yide.

alter table public.social_media_posts
  add column if not exists instagram_post_id text,
  add column if not exists facebook_post_id text,
  add column if not exists publicado_em timestamptz,
  add column if not exists publish_error text,
  add column if not exists publish_attempts int not null default 0,
  add column if not exists last_publish_attempt_at timestamptz;

comment on column public.social_media_posts.instagram_post_id is
  'ID do media publicado no Instagram (formato Graph API). Preenchido após sucesso.';
comment on column public.social_media_posts.facebook_post_id is
  'ID do post publicado no Facebook (page_id_post_id). Preenchido após sucesso.';
comment on column public.social_media_posts.publish_error is
  'Mensagem do último erro de publicação (Graph API ou validação). Null = sem erro.';
comment on column public.social_media_posts.publish_attempts is
  'Quantas tentativas de publicar já rolaram. Cron desiste após 5 tentativas.';

create index if not exists social_posts_ready_to_publish_idx
  on public.social_media_posts(agendar_para)
  where archived_at is null
    and status = 'agendado'
    and publish_attempts < 5;
