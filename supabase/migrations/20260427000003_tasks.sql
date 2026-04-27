-- supabase/migrations/20260427000003_tasks.sql
create type public.task_priority as enum ('alta', 'media', 'baixa');
create type public.task_status as enum ('aberta', 'em_andamento', 'concluida');

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  prioridade public.task_priority not null default 'media',
  status public.task_status not null default 'aberta',
  criado_por uuid not null references public.profiles(id),
  atribuido_a uuid not null references public.profiles(id),
  client_id uuid references public.clients(id) on delete set null,
  due_date date,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index idx_tasks_atribuido on public.tasks(atribuido_a, status);
create index idx_tasks_criado_por on public.tasks(criado_por);
create index idx_tasks_client on public.tasks(client_id);
create index idx_tasks_due_date on public.tasks(due_date);

create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;

create policy "authenticated read tasks"
  on public.tasks for select to authenticated using (true);

create policy "authenticated insert tasks they create"
  on public.tasks for insert to authenticated
  with check (criado_por = auth.uid());

create policy "creator or assignee can update task"
  on public.tasks for update to authenticated
  using (criado_por = auth.uid() or atribuido_a = auth.uid())
  with check (criado_por = auth.uid() or atribuido_a = auth.uid());

create policy "creator or adm/socio can delete task"
  on public.tasks for delete to authenticated
  using (criado_por = auth.uid() or public.current_user_role() in ('adm', 'socio'));
