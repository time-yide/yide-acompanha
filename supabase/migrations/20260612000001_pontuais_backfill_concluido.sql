-- Backfill dos serviços pontuais existentes.
-- Roda DEPOIS de 20260612000000 (enum 'concluido' já commitado).
--
-- Regra de conclusão: data_churn = último dia do mês de data_entrada.
--   ( (date_trunc('month', data_entrada) + interval '1 month - 1 day')::date )

-- 1) Pontuais cujo mês de entrada JÁ terminou → concluido + data de conclusão.
update public.clients
set status = 'concluido',
    data_churn = coalesce(
      data_churn,
      (date_trunc('month', data_entrada) + interval '1 month - 1 day')::date
    )
where modalidade = 'pontual'
  and status = 'ativo'
  and deleted_at is null
  and (date_trunc('month', data_entrada) + interval '1 month')::date <= current_date;

-- 2) Pontuais do mês corrente (ainda ativos) → só grava a data de conclusão.
update public.clients
set data_churn = coalesce(
      data_churn,
      (date_trunc('month', data_entrada) + interval '1 month - 1 day')::date
    )
where modalidade = 'pontual'
  and status = 'ativo'
  and deleted_at is null
  and (date_trunc('month', data_entrada) + interval '1 month')::date > current_date;
