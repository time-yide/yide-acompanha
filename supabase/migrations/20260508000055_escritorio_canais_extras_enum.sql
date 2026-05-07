-- supabase/migrations/20260508000055_escritorio_canais_extras_enum.sql
-- Adiciona 3 novos kinds ao enum chat_channel_kind. A migração que insere
-- os canais e atualiza a função vai numa migration separada (PG não permite
-- usar enum value recém-adicionado na mesma transação que ele foi criado).

alter type public.chat_channel_kind add value if not exists 'geral';
alter type public.chat_channel_kind add value if not exists 'comercial';
alter type public.chat_channel_kind add value if not exists 'administrativo';
