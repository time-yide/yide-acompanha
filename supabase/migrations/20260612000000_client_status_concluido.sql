-- Adiciona o status 'concluido' ao enum de status de clientes.
-- Usado por serviços pontuais (modalidade='pontual'), que encerram no fim do
-- mês de entrada sem virar churn.
--
-- IMPORTANTE: rodar este arquivo SOZINHO (em execução separada do backfill).
-- ALTER TYPE ADD VALUE não pode ser referenciado na mesma transação.
ALTER TYPE public.client_status ADD VALUE IF NOT EXISTS 'concluido';
