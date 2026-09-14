-- Reduz retenção de gravações de reunião de 90 para 60 dias.
-- Economiza storage no Supabase (gravações são os arquivos mais pesados).

-- 1. Atualiza o trigger pra novas reuniões usarem 60 dias
create or replace function public.set_meeting_retain_until()
returns trigger language plpgsql as $$
begin
  if new.starts_at is not null then
    new.retain_until := new.starts_at + interval '60 days';
  else
    new.retain_until := null;
  end if;
  return new;
end;
$$;

-- 2. Atualiza reuniões existentes que ainda têm retenção > 60 dias
--    (só as que não têm override manual)
update public.meetings
set retain_until = starts_at + interval '60 days'
where starts_at is not null
  and retencao_override is null
  and retain_until is not null
  and retain_until > starts_at + interval '60 days';
