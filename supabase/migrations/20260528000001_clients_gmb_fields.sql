-- Adiciona campos de Google Meu Negócio (GMB) em clients pra registro
-- manual da situação do perfil. Cliente vê no portal.
--
-- Fase 1: cadastro manual (Yasmin/assessor digita nota/reviews/link).
-- Fase 2 (futura): integração real com Google Business Profile API
-- via OAuth — autopopulação.

alter table public.clients
  add column gmb_link text,
  add column gmb_rating numeric(2,1) check (gmb_rating is null or (gmb_rating >= 0 and gmb_rating <= 5)),
  add column gmb_review_count integer check (gmb_review_count is null or gmb_review_count >= 0),
  add column gmb_last_update_at timestamptz;

comment on column public.clients.gmb_link is
  'URL pública do perfil Google Meu Negócio (Google Maps). Aparece no portal '
  'pro cliente acessar direto.';
comment on column public.clients.gmb_rating is
  'Nota média do GMB (0.0 a 5.0). Atualizado manualmente. Null = não cadastrado.';
comment on column public.clients.gmb_review_count is
  'Quantidade de avaliações no GMB. Null = não cadastrado.';
comment on column public.clients.gmb_last_update_at is
  'Quando os dados do GMB foram atualizados pela última vez. Mostrado no '
  'portal pra transparência de quão fresca é a info.';
