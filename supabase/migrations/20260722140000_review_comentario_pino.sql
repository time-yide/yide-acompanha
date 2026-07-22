-- Anotação "alfinete/balão" no frame (estilo Frame.io): posição normalizada
-- (0..1) do comentário sobre o vídeo, presa à minutagem daquele comentário.
-- NULL = comentário sem marcador (comportamento antigo, retrocompatível).
-- Aplicação MANUAL no SQL Editor após o merge.
alter table public.review_comentario
  add column if not exists pos_x real,
  add column if not exists pos_y real;
