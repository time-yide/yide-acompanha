-- supabase/migrations/20260501000027_calendar_subs_enum.sql
-- Adiciona 3 sub-calendários novos: videomakers, assessores, coordenadores.
-- Em migration separada porque o ALTER TYPE não pode ser usado na mesma transação
-- em que outra DDL referencia o novo valor.

alter type public.sub_calendar add value if not exists 'videomakers';
alter type public.sub_calendar add value if not exists 'assessores';
alter type public.sub_calendar add value if not exists 'coordenadores';
