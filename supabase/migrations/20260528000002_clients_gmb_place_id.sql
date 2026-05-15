-- Adiciona gmb_place_id pra integração automática via Google Places API.
-- Place ID é o identificador canônico do Google pra localização do GMB
-- (formato "ChIJ..."). Quando preenchido, cron diário busca dados frescos
-- via API. Quando vazio (ou sem GOOGLE_PLACES_API_KEY no env), sistema
-- cai pro modo manual (assessor digita nota/reviews).

alter table public.clients
  add column gmb_place_id text;

create index idx_clients_gmb_place_id on public.clients(gmb_place_id)
  where gmb_place_id is not null;

comment on column public.clients.gmb_place_id is
  'Google Places ID do perfil GMB. Quando preenchido, cron de refresh '
  'busca rating/review_count via Places API. Vazio = modo manual.';
