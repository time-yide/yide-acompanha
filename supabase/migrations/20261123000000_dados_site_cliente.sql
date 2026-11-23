-- Painel Dados: site do cliente + criação de GA4 / verificação do Search Console.
-- Aplicar manualmente no SQL Editor (Vercel não roda migrations).
alter table public.clients
  add column if not exists site_url text,
  add column if not exists sem_site boolean not null default false,
  add column if not exists ga4_measurement_id text;

comment on column public.clients.site_url is 'Endereço do site do cliente (origem normalizada, ex.: https://exemplo.com.br). Null = não cadastrado.';
comment on column public.clients.sem_site is 'true = confirmado que o cliente não tem site (canal Site/Google vira perda real no painel Dados).';
comment on column public.clients.ga4_measurement_id is 'ID de medição do fluxo web do GA4 (G-XXXX), usado pra mostrar o código de instalação.';
