-- Motivo de churn categorizado (dropdown de opções fixas) pro relatório de
-- "motivo que mais causa churn". O texto livre `motivo_churn` permanece como
-- detalhe opcional. Coluna nullable: clientes existentes/ativos ficam null.

create type public.churn_motivo as enum (
  'preco',
  'insatisfacao_resultado',
  'insatisfacao_equipe',
  'empresa_fechou',
  'concorrente',
  'inadimplencia',
  'contrato_encerrado'
);

alter table public.clients
  add column motivo_churn_categoria public.churn_motivo;

create index idx_clients_motivo_churn_categoria
  on public.clients(motivo_churn_categoria)
  where motivo_churn_categoria is not null;
