-- Módulo Pesquisas — parte 1/2: novo valor no enum de notificação.
-- ALTER TYPE ADD VALUE não pode ser usado na mesma transação em que o valor é
-- referenciado, então roda numa migration própria ANTES da 20260721000001.
alter type public.notification_event add value if not exists 'pesquisa_disparada';
