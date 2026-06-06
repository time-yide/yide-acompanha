-- =====================================================
-- DESIGN STUDIO — FASE 1
-- Composição editável da arte (camadas + fundo + formato).
-- midias[0] continua sendo a URL do PNG exportado (o que o cliente aprova).
-- =====================================================
alter table public.design_artes
  add column if not exists composicao jsonb;

comment on column public.design_artes.composicao is
  'Estado reabrível da canvas do Studio: { formato, fundo, camadas[] }. NULL para artes de cadastro manual.';
