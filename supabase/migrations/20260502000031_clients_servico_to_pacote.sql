-- supabase/migrations/20260502000031_clients_servico_to_pacote.sql
-- Best-effort: infere tipo_pacote a partir de servico_contratado livre.
-- Linhas convertidas ficam tipo_pacote_revisado=false até sócio confirmar.

update public.clients set tipo_pacote = case
  when servico_contratado ilike '%trafego%estrat%'
    or servico_contratado ilike '%tráfego%estrat%'
    or servico_contratado ilike '%estrat%trafego%'
    or servico_contratado ilike '%estrat%tráfego%' then 'trafego_estrategia'::public.tipo_pacote
  when servico_contratado ilike '%yide%360%'
    or servico_contratado ilike '%full%'
    or servico_contratado ilike '%premium%' then 'yide_360'::public.tipo_pacote
  when servico_contratado ilike '%trafego%'
    or servico_contratado ilike '%tráfego%' then 'trafego'::public.tipo_pacote
  when servico_contratado ilike '%estrat%' then 'estrategia'::public.tipo_pacote
  when servico_contratado ilike '%audiovisual%'
    or servico_contratado ilike '%video%'
    or servico_contratado ilike '%vídeo%' then 'audiovisual'::public.tipo_pacote
  when servico_contratado ilike '%site%' then 'site'::public.tipo_pacote
  when servico_contratado ilike '%crm%ia%'
    or servico_contratado ilike '%ia%crm%' then 'crm_ia'::public.tipo_pacote
  when servico_contratado ilike '%crm%' then 'crm'::public.tipo_pacote
  when servico_contratado ilike '%ia%' then 'ia'::public.tipo_pacote
  else 'trafego_estrategia'::public.tipo_pacote
end
where tipo_pacote is null;

-- Garante que ninguém ficou null
update public.clients
set tipo_pacote = 'trafego_estrategia'::public.tipo_pacote
where tipo_pacote is null;

-- Agora que está populado, vira NOT NULL
alter table public.clients
  alter column tipo_pacote set not null;

-- A flag tipo_pacote_revisado já vem default false; sócio precisa confirmar manualmente.
