-- Valores novos pra suportar:
-- - "Alteração" coluna do kanban (tarefa rejeitada na aprovação)
-- - "Agendado" coluna entre aprovado e postado
-- - Notif quando tarefa entra em alteração
-- ALTER TYPE ... ADD VALUE precisa rodar isolada (regra Postgres).

ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'alteracao';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'agendado';
ALTER TYPE notification_event ADD VALUE IF NOT EXISTS 'task_alteracao_solicitada';
