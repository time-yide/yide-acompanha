-- Link público de aprovação do cliente pro vídeo do Frame (mesmo padrão de
-- design_artes/social posts). Aplicação MANUAL no SQL Editor após o merge.
alter table public.review_video
  add column if not exists aprovacao_token uuid unique default gen_random_uuid();

-- Backfill: o default só vale pra linhas novas; gera token pras existentes.
update public.review_video
  set aprovacao_token = gen_random_uuid()
  where aprovacao_token is null;
