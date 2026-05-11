-- Adiciona coluna link_estrategia em clients (Drive, Gamma ou qualquer URL
-- do documento de estratégia atual do cliente). Usada pelo painel mensal pra
-- marcar a step de Cronograma como pronta automaticamente.
alter table public.clients
  add column if not exists link_estrategia text;
