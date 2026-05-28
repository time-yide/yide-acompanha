alter table public.freela_oportunidades
  add column if not exists tipo text not null default 'captacao'
    check (tipo in ('captacao','modelo'));
