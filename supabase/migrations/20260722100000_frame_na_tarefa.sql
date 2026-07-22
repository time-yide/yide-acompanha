-- Frame na Tarefa. Aplicação MANUAL no SQL Editor após o merge.
alter table public.review_video add column if not exists task_id uuid references public.tasks(id) on delete set null;
create index if not exists review_video_task_idx on public.review_video(task_id) where task_id is not null;

create table if not exists public.review_assistido (
  user_id uuid not null references public.profiles(id) on delete cascade,
  versao_id uuid not null references public.review_versao(id) on delete cascade,
  pct_max int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, versao_id)
);
alter table public.review_assistido enable row level security;
drop policy if exists review_assistido_read on public.review_assistido;
create policy review_assistido_read on public.review_assistido for select to authenticated using (true);
