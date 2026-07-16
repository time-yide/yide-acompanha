-- Painel: cronograma mensal + tarefa de design auto-criada.
-- cronograma_url: link do cronograma (drive) do mês; ao subir, o assessor
-- informa a quantidade do pacote (pacote_post, já existente) e o sistema cria
-- uma tarefa pro designer. design_task_id aponta pra essa tarefa (a coluna
-- "Design" no painel reflete o status dela).
alter table public.client_monthly_checklist
  add column if not exists cronograma_url text,
  add column if not exists design_task_id uuid references public.tasks(id) on delete set null;
