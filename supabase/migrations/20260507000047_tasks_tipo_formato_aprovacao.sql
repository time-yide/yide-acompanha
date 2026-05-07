-- supabase/migrations/20260507000047_tasks_tipo_formato_aprovacao.sql
-- Adiciona tipo (geral/video/arte), formatos (feed/story[]), status_aprovacao
-- e tabela task_revisoes (histórico do ciclo de aprovação) à tabela tasks.

-- 1. Enums
create type public.task_tipo as enum ('geral', 'video', 'arte');
create type public.task_formato as enum ('feed', 'story');
create type public.task_aprovacao as enum (
  'pendente_envio',     -- atribuído ainda não entregou
  'em_analise',         -- atribuído enviou, aguardando assessor
  'aprovado',           -- assessor aprovou
  'ajustes_solicitados' -- assessor pediu ajustes
);
create type public.task_revisao_tipo as enum ('envio', 'aprovacao', 'ajustes');

-- 2. Novos campos em tasks
alter table public.tasks
  add column tipo public.task_tipo not null default 'geral',
  add column formatos public.task_formato[] not null default '{}',
  add column status_aprovacao public.task_aprovacao;

create index idx_tasks_tipo on public.tasks(tipo) where tipo <> 'geral';

-- 3. Tabela de revisões (histórico do ciclo de aprovação — append-only)
create table public.task_revisoes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  autor_id uuid not null references public.profiles(id),
  tipo public.task_revisao_tipo not null,
  observacoes text,
  criado_em timestamptz not null default now()
);

create index idx_task_revisoes_task on public.task_revisoes(task_id, criado_em desc);

alter table public.task_revisoes enable row level security;

create policy "authenticated read task_revisoes"
  on public.task_revisoes for select to authenticated using (true);

-- Insert: criador, atribuído ou participante da tarefa associada.
-- (Validação de quem-pode-fazer-qual-tipo fica na server action.)
create policy "task members insert revisao"
  on public.task_revisoes for insert to authenticated
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_id
        and (
          t.criado_por = auth.uid()
          or t.atribuido_a = auth.uid()
          or auth.uid() = any(t.participantes_ids)
        )
    )
  );

-- Sem update/delete: histórico imutável.
