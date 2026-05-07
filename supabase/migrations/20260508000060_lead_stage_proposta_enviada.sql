-- Adiciona o estágio "proposta_enviada" no funil de leads, entre
-- leads_ativos e reuniao_comercial. Lead vai pra esse stage quando o
-- comercial enviou proposta com valor — antes era misturado em leads_ativos.
-- ALTER TYPE ADD VALUE não pode rodar dentro de transação que usa esse
-- valor depois, por isso essa migration roda separada de qualquer mudança
-- que dependa do novo enum.

alter type public.lead_stage add value if not exists 'proposta_enviada' after 'leads_ativos';
