-- supabase/migrations/20260515000000_reunioes_retencao.sql
--
-- Política de retenção LGPD: gravações de reunião são apagadas 90 dias após
-- a data da reunião, exceto quando o user marca explicitamente como
-- "reter permanentemente".
--
-- Estratégia:
--  - Coluna meetings.retain_until: timestamptz, default starts_at + 90 dias
--  - Cron diário /api/cron/cleanup-old-recordings procura
--    meeting_recordings cujo meeting.retain_until < now() e apaga o arquivo
--    no Storage + a row em meeting_recordings (preserva o meeting + transcript
--    + summary — só a gravação é deletada).
--  - User pode estender retain_until via UI (ex.: marcar como "manter pra sempre"
--    = retain_until = null).
--
-- O que NÃO é deletado:
--  - meetings.* (resumo, transcript continuam disponíveis indefinidamente)
--  - meeting_transcripts.* (texto continua, só sem áudio pra ouvir de novo)
--  - meeting_summaries.*, meeting_extracted_tasks.*
--
-- Isso atende a LGPD (gravação é o dado sensível, não a transcrição em texto
-- que já passou por curadoria IA) e mantém o histórico útil pro time.

alter table public.meetings
  add column if not exists retain_until timestamptz
    generated always as (
      case
        when starts_at is null then null
        else starts_at + interval '90 days'
      end
    ) stored;

create index if not exists idx_meetings_retain_until
  on public.meetings(retain_until)
  where retain_until is not null;

-- Permite override manual: separa em coluna não-generated que sobrescreve.
-- Padrão: usa o generated; user pode escrever null (manter pra sempre) ou
-- uma data customizada (estender).
alter table public.meetings
  add column if not exists retencao_override timestamptz;

-- View pro cron pegar facilmente recordings vencidos
create or replace view public.meeting_recordings_to_cleanup as
select
  r.id as recording_id,
  r.meeting_id,
  r.audio_url as storage_path,
  m.retencao_override,
  m.retain_until as retain_until_default,
  coalesce(m.retencao_override, m.retain_until) as retain_until_efetiva
from public.meeting_recordings r
join public.meetings m on m.id = r.meeting_id
where coalesce(m.retencao_override, m.retain_until) is not null
  and coalesce(m.retencao_override, m.retain_until) < now();

comment on view public.meeting_recordings_to_cleanup is
  'Gravações cuja retenção venceu. Consumida pelo cron /api/cron/cleanup-old-recordings.';

comment on column public.meetings.retencao_override is
  'Override manual da retenção. NULL = usar default (90d). Valor custom = nova data limite. ' ||
  'Pra "manter pra sempre", set como uma data futura distante (ex.: 2099-12-31).';
