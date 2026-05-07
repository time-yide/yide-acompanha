-- Adiciona o estágio "proposta_enviada" no funil de leads, posicionado
-- ENTRE reuniao_comercial e contrato. Fluxo correto: o comercial faz a
-- reunião primeiro, depois manda a proposta com valor — só então segue
-- pro contrato.
-- ALTER TYPE ADD VALUE é idempotente com IF NOT EXISTS — se já tinha
-- rodado uma versão anterior dessa migration (com posição diferente),
-- o valor permanece e a app não quebra (a ordem do enum no DB não é
-- usada por queries; STAGES no TypeScript dita a ordem da UI).

alter type public.lead_stage add value if not exists 'proposta_enviada' after 'reuniao_comercial';
