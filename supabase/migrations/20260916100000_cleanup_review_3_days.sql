-- Reduz retenção de vídeos aprovados de 20 para 3 dias.
-- Também inclui vídeos cuja tarefa vinculada já foi postada (status 'postada').
create or replace view public.review_videos_to_cleanup as
select
  rv.id         as video_id,
  rv.status,
  rv.updated_at as aprovado_em,
  ver.id        as versao_id,
  ver.bunny_video_id
from public.review_video rv
join public.review_versao ver on ver.review_video_id = rv.id
where ver.bunny_video_id is not null
  and (
    (rv.status = 'aprovado' and rv.updated_at < now() - interval '3 days')
    or
    (rv.task_id is not null and exists (
      select 1 from public.tasks t
      where t.id = rv.task_id and t.status = 'postada'
        and t.updated_at < now() - interval '3 days'
    ))
  );
