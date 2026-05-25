-- supabase/migrations/20260611000000_corrige_ecommerce_tipo_pacote.sql
--
-- Conserta o tipo_pacote de clientes que foram salvos como "E-commerce" via
-- ServicoPopover antes do fix da função inferTipoPacote.
--
-- Bug: inferTipoPacote() não tinha case pra "E-commerce" → caía no fallback
-- de "trafego_estrategia". Resultado: servico_contratado = "E-commerce" mas
-- tipo_pacote = "trafego_estrategia". Cliente continuava aparecendo em
-- filtros que usam tipo_pacote (como rastreio de Instagram).
--
-- Esta migration atualiza retroativamente: todo cliente com
-- servico_contratado ILIKE '%e-commerce%' OU '%ecommerce%' vira
-- tipo_pacote='ecommerce'.

update public.clients
set tipo_pacote = 'ecommerce'::public.tipo_pacote
where (
  servico_contratado ilike '%e-commerce%'
  or servico_contratado ilike '%ecommerce%'
  or servico_contratado ilike '%e commerce%'
)
and tipo_pacote != 'ecommerce'::public.tipo_pacote
and deleted_at is null;
