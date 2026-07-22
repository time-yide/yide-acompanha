-- Novo tipo de agenda (sub_calendar) "comercial" no Calendário Interno.
-- Aplicação MANUAL no SQL Editor após o merge.
alter type public.sub_calendar add value if not exists 'comercial';
