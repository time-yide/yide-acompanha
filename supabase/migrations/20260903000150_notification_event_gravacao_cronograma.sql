-- ALTER TYPE ADD VALUE precisa rodar isolada (regra Postgres).
alter type public.notification_event add value if not exists 'gravacao_alinhada';
alter type public.notification_event add value if not exists 'gravacao_pendente_lembrete';
