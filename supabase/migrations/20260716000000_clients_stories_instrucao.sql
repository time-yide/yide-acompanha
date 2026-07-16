-- Instrução/indicação por cliente pra Fast Mídia ler ao produzir stories.
-- Coluna additiva, nullable. Não referenciada por código existente.
alter table public.clients
  add column if not exists stories_instrucao text;
