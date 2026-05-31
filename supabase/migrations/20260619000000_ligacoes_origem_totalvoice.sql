-- supabase/migrations/20260619000000_ligacoes_origem_totalvoice.sql
-- Libera origem 'totalvoice'/'zenvia' nas ligações (integração de voz Zenvia).
alter table public.ligacoes
  drop constraint if exists ligacoes_origem_check;

alter table public.ligacoes
  add constraint ligacoes_origem_check
  check (origem in ('manual','twilio','evolution','zapi','ifix','voip_generic','mock','outro','totalvoice','zenvia'));
