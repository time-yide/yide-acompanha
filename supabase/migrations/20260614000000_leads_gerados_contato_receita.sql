-- Contato oficial da empresa vindo da Receita Federal (via CNPJá), preenchido
-- automaticamente quando a pesquisa roda. Mantém-se separado de telefone/whatsapp
-- (Google Maps) pra não sobrescrever o contato já existente.

alter table public.leads_gerados
  add column if not exists telefone_receita text,
  add column if not exists email_receita text;
