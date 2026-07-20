-- Novo tipo de agenda (sub_calendar) "programacao" no Calendário Interno.
-- Enum values só podem ser adicionados (não removidos). O `if not exists`
-- deixa a migration idempotente.
alter type public.sub_calendar add value if not exists 'programacao';
