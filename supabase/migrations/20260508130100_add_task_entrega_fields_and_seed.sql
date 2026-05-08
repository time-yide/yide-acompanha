-- Campos de entrega obrigatórios pra editor/videomaker/designer/audiovisual_chefe
-- ao mover tarefa pra "Concluído Operacional" (ex-"Concluída"). Por enquanto
-- nullables — tarefas antigas em "concluida" não são afetadas. Validação
-- acontece no server action, não no schema (pra permitir update legado).

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS drive_link TEXT,
  ADD COLUMN IF NOT EXISTS entrega_observacoes TEXT;

INSERT INTO notification_rules
  (evento_tipo, ativo, mandatory, email_default, permite_destinatarios_extras, default_roles, default_user_ids)
VALUES
  ('task_alteracao_solicitada', true, true, false, true, '{}', '{}')
ON CONFLICT (evento_tipo) DO NOTHING;
