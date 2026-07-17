-- supabase/migrations/20260717100000_freelayide_data_hora.sql
-- Data+hora estruturada da oportunidade, pra reservar o slot na agenda de
-- quem pegou. `horario` (texto livre) fica mantido por compatibilidade.
alter table public.freela_oportunidades
  add column if not exists data_hora   timestamptz,
  add column if not exists duracao_min integer not null default 60;

-- Query da agenda busca por dono + janela de tempo.
create index if not exists freela_op_agenda_idx
  on public.freela_oportunidades (pego_por, data_hora)
  where data_hora is not null and deleted_at is null;
