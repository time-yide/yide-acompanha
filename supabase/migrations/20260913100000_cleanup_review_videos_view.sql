-- View: vídeos de review aprovados há mais de 20 dias, prontos pra limpeza do Bunny.
-- Usada pelo cron cleanup-old-review-videos.
create or replace view public.review_videos_to_cleanup as
select
  rv.id         as video_id,
  rv.status,
  rv.updated_at as aprovado_em,
  ver.id        as versao_id,
  ver.bunny_video_id
from public.review_video rv
join public.review_versao ver on ver.review_video_id = rv.id
where rv.status = 'aprovado'
  and rv.updated_at < now() - interval '20 days'
  and ver.bunny_video_id is not null;
