-- Adiciona status "pendente" ao freela_oportunidades.
-- Qualquer pessoa da equipe pode lançar um freela; ele entra como "pendente"
-- e só vira "pega" após aprovação da gestão.

-- 1) Trocar CHECK constraint de status pra incluir "pendente"
alter table public.freela_oportunidades
  drop constraint if exists freela_oportunidades_status_check;
alter table public.freela_oportunidades
  add constraint freela_oportunidades_status_check
    check (status in ('pendente','disponivel','pega','em_negociacao','fechada','perdida'));

-- 2) Evento de notificação pra gestão aprovar
alter type public.notification_event add value if not exists 'freela_pendente_aprovacao';

-- 3) Evento: freela aprovado (notifica quem lançou)
alter type public.notification_event add value if not exists 'freela_aprovada';
