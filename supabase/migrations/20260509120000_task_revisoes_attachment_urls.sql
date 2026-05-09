-- supabase/migrations/20260509120000_task_revisoes_attachment_urls.sql
-- Permite anexar imagens ao pedido de ajustes (PDF do print, screenshot
-- com seta apontando o erro, etc). URLs públicas do bucket task-attachments.

alter table public.task_revisoes
  add column attachment_urls text[] not null default '{}';
