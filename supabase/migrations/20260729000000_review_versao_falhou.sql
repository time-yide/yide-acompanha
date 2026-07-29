-- Marca versões de vídeo cujo processamento no Bunny FALHOU (status 5=error /
-- 6=upload failed). Antes o código tratava esses status como "pronto", então
-- um vídeo quebrado virava uma capa preta que não tocava, sem aviso. Com esta
-- coluna o card mostra "Falhou — reenviar" em vez de um card misterioso.
alter table review_versao
  add column if not exists falhou boolean not null default false;
