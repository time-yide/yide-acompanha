-- supabase/migrations/20260504000040_tasks_anexos_links_participantes.sql
-- Estende tasks com campos pra anexos, links e participantes adicionais.

alter table public.tasks
  add column participantes_ids uuid[] not null default '{}',
  add column links jsonb not null default '[]'::jsonb,
  add column attachment_urls text[] not null default '{}';

create index idx_tasks_participantes on public.tasks using gin (participantes_ids);

-- Bucket pra anexos de tarefas (imagens só, validação no app)
insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', true)
on conflict (id) do nothing;

create policy "task-attachments read"
  on storage.objects for select to authenticated
  using (bucket_id = 'task-attachments');

create policy "task-attachments insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'task-attachments');

create policy "task-attachments delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'task-attachments'
    and (owner = auth.uid() or current_user_role() in ('adm'::user_role, 'socio'::user_role))
  );
