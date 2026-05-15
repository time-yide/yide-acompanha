-- Adiciona coluna `link_etapa` em client_onboarding_etapas pra Yasmin colar
-- URLs de referência por etapa — ex: link da estratégia em "Tráfego + estratégia",
-- link da pasta na "Planejamento e produção", etc.
--
-- Generic e nullable — cada etapa decide se mostra (ou só rotula diferente)
-- baseado em etapa_codigo no client.

alter table public.client_onboarding_etapas
  add column link_etapa text;
