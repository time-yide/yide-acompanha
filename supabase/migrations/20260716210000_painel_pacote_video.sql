-- Painel: separar a quantidade do pacote em artes (posts) e vídeos.
-- pacote_post (já existente) = quantidade de artes/posts do cronograma.
-- pacote_video (novo) = quantidade de vídeos do cronograma.
-- O assessor informa os dois números ao subir o cronograma (CronogramaModal).
alter table public.client_monthly_checklist
  add column if not exists pacote_video integer;
