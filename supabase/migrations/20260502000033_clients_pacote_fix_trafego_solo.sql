-- supabase/migrations/20260502000033_clients_pacote_fix_trafego_solo.sql
-- Corrige clientes com servico_contratado = tráfego/trafégo sem "+Estratégia"
-- que foram classificados incorretamente como trafego_estrategia pelo fallback.

update public.clients
set tipo_pacote = 'trafego'::public.tipo_pacote
where (servico_contratado ilike '%trafego%'
    or servico_contratado ilike '%tráfego%'
    or servico_contratado ilike '%trafégo%')
  and servico_contratado not ilike '%estrat%'
  and tipo_pacote = 'trafego_estrategia'::public.tipo_pacote;
