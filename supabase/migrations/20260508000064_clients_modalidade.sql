-- Diferencia clientes mensais (recorrentes — maioria) de pontuais (serviço
-- único, ex.: vídeo institucional avulso). Modalidade afeta:
-- - churn: pontual encerrado NÃO conta como churn (não tinha contrato pra
--   "perder")
-- - métricas: contagem separada de "Serviços pontuais"
-- - carteira ativa: pontual em status=ativo continua somando enquanto
--   estiver vigente (mesmo conceito do mensal — "entra no valor geral")

create type public.client_modalidade as enum ('mensal', 'pontual');

alter table public.clients
  add column modalidade public.client_modalidade not null default 'mensal';

create index idx_clients_modalidade on public.clients(modalidade);
