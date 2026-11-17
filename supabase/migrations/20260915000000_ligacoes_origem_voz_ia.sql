-- Libera origem 'voz_ia' na tabela ligacoes para que as ligações
-- feitas pelo agente de voz IA apareçam no dashboard de Ligações.
alter table public.ligacoes
  drop constraint if exists ligacoes_origem_check;

alter table public.ligacoes
  add constraint ligacoes_origem_check
  check (origem in ('manual','twilio','evolution','zapi','ifix','voip_generic','mock','outro','totalvoice','zenvia','voz_ia'));
