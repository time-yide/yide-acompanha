alter table public.freela_oportunidades
  add column if not exists data date,
  add column if not exists horario text;
