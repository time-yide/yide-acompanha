-- supabase/migrations/20260507000048_tasks_pipeline_chat.sql
-- Pipeline ampliado de status (Aberta → Em andamento → Concluído → Aprovação →
-- Aprovado → Postado) + chat por tarefa + carimbo de quando virou Aprovada
-- (pra alerta de >24h sem postar).

-- 1. Novos valores no enum task_status
alter type public.task_status add value if not exists 'em_aprovacao';
alter type public.task_status add value if not exists 'aprovada';
alter type public.task_status add value if not exists 'postada';

-- 2. Carimbo de quando a tarefa entrou em "aprovada"
alter table public.tasks
  add column aprovada_em timestamptz;

-- 3. Tabela de comentários (chat por tarefa)
create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  autor_id uuid not null references public.profiles(id),
  conteudo text not null,
  criado_em timestamptz not null default now()
);

create index idx_task_comments_task on public.task_comments(task_id, criado_em desc);

alter table public.task_comments enable row level security;

-- Read: criador, atribuído, participantes da tarefa OU adm/sócio
create policy "task members read comments"
  on public.task_comments for select to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id
        and (
          t.criado_por = auth.uid()
          or t.atribuido_a = auth.uid()
          or auth.uid() = any(t.participantes_ids)
        )
    )
    or public.current_user_role() in ('adm', 'socio')
  );

-- Insert: só pode comentar quem está vinculado à tarefa (autor_id = self)
create policy "task members insert comments"
  on public.task_comments for insert to authenticated
  with check (
    autor_id = auth.uid()
    and exists (
      select 1 from public.tasks t
      where t.id = task_id
        and (
          t.criado_por = auth.uid()
          or t.atribuido_a = auth.uid()
          or auth.uid() = any(t.participantes_ids)
        )
    )
  );

-- Sem update/delete: comentários imutáveis (v1).
