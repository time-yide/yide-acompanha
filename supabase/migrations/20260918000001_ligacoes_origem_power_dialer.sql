-- Libera origem 'power_dialer' na tabela ligacoes para que as ligações
-- discadas pelo Power Dialer (post-call.ts) apareçam no dashboard de
-- Ligações. Sem isso o insert em power-dialer/post-call.ts viola o
-- check constraint e falha silenciosamente (try/catch com console.error).
alter table public.ligacoes
  drop constraint if exists ligacoes_origem_check;

alter table public.ligacoes
  add constraint ligacoes_origem_check
  check (origem in ('manual','twilio','evolution','zapi','ifix','voip_generic','mock','outro','totalvoice','zenvia','voz_ia','power_dialer'));
