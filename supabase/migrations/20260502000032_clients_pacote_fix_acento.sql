-- supabase/migrations/20260502000032_clients_pacote_fix_acento.sql
-- Corrige mapeamento de "Trafégo+Estratégia" (acento em é, não á) que caiu em
-- estrategia em vez de trafego_estrategia, e "Trafégo" que caiu no fallback.

-- Temporariamente remove NOT NULL para permitir a correção via update
alter table public.clients
  alter column tipo_pacote drop not null;

update public.clients
set tipo_pacote = 'trafego_estrategia'::public.tipo_pacote
where servico_contratado ilike '%trafego%estrat%'
   or servico_contratado ilike '%tráfego%estrat%'
   or servico_contratado ilike '%trafégo%estrat%'
   or servico_contratado ilike '%estrat%trafego%'
   or servico_contratado ilike '%estrat%tráfego%'
   or servico_contratado ilike '%estrat%trafégo%';

update public.clients
set tipo_pacote = 'trafego'::public.tipo_pacote
where (servico_contratado ilike '%trafego%'
    or servico_contratado ilike '%tráfego%'
    or servico_contratado ilike '%trafégo%')
  and tipo_pacote != 'trafego_estrategia'::public.tipo_pacote;

-- Restaura NOT NULL
alter table public.clients
  alter column tipo_pacote set not null;
