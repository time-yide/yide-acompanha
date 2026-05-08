-- Quando uma captação é delegada pra editar, criamos uma task e linkamos
-- via task_id. NULL = ainda não delegada. ON DELETE SET NULL pra deletar
-- task não quebrar a captura (volta a ficar "pendente de delegação").
ALTER TABLE audiovisual_capturas
  ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_audiovisual_capturas_task_id
  ON audiovisual_capturas (task_id);
