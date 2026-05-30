-- supabase/migrations/20260618000000_freelayide_edicao_tipo.sql
-- Adiciona o tipo 'edicao' às oportunidades do Freelayide.
-- O check da coluna `tipo` foi criado inline na 20260616000000_freelayide_tipo.sql
-- com nome auto-gerado freela_oportunidades_tipo_check.

alter table public.freela_oportunidades
  drop constraint if exists freela_oportunidades_tipo_check;

alter table public.freela_oportunidades
  add constraint freela_oportunidades_tipo_check
  check (tipo in ('captacao', 'modelo', 'edicao'));
