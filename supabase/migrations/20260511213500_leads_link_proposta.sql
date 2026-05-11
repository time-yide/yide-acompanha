-- Adiciona coluna link_proposta em leads — URL da proposta enviada ao cliente
-- (Drive, Notion, Docs etc.). Preenchido no dialog de transição
-- pra stage "proposta_enviada".

alter table public.leads
  add column if not exists link_proposta text;
