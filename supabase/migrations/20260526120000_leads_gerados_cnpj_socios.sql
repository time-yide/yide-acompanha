-- Adiciona campos pra identificação oficial do decisor via Receita Federal (CNPJá)
-- e contato pessoal do decisor (WhatsApp, Instagram).

alter table public.leads_gerados
  add column if not exists cnpj text,
  add column if not exists socios jsonb not null default '[]'::jsonb,
  add column if not exists socio_principal_qualificacao text,
  add column if not exists decisor_whatsapp text,
  add column if not exists decisor_instagram text;

create index if not exists leads_gerados_cnpj_idx
  on public.leads_gerados(cnpj)
  where cnpj is not null;
