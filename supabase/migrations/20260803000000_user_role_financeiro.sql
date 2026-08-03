-- Adiciona o cargo `financeiro` ao enum public.user_role.
-- `add value` precisa rodar isolado (fora de transação que já use o valor),
-- por isso a migration só faz isto. Idempotente com `if not exists`.
alter type public.user_role add value if not exists 'financeiro';
