-- Permite Instagram e Facebook também conectados via Post for Me (unificação).
alter table public.client_postforme_accounts
  drop constraint if exists client_postforme_accounts_plataforma_check;
alter table public.client_postforme_accounts
  add constraint client_postforme_accounts_plataforma_check
  check (plataforma in ('tiktok','youtube','linkedin','instagram','facebook'));
