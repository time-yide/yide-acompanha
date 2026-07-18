-- Novo evento de notificação pra desbloqueio de conquista.
-- IMPORTANTE: rode ESTE arquivo e confirme (commit) ANTES do seed da regra
-- (20260718200200), porque o Postgres não deixa usar um valor de enum recém-criado
-- na mesma transação que o adicionou.
alter type public.notification_event add value if not exists 'conquista_desbloqueada';
