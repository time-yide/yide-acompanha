-- Marca uma pesquisa como bloqueante: quando true + status 'aberta', ela trava a
-- tela (lock gate) de todo destinatário que ainda não respondeu.
alter table public.pesquisas
  add column if not exists bloqueante boolean not null default false;
