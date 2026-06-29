-- Relatório Fase 2: seções (redes/tráfego) + snapshot dos dados de tráfego.
alter table public.social_media_relatorios
  add column if not exists secoes text[] not null default '{redes}',
  add column if not exists dados_trafego jsonb;
