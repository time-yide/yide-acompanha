-- supabase/migrations/20260509130000_yide_academy.sql
-- Yide Academy: cursos internos com prova obrigatória + ranking de pontos.

-- 1. Cursos
create table public.academy_cursos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(trim(titulo)) >= 2 and length(titulo) <= 200),
  descricao text not null check (length(trim(descricao)) >= 1),
  criado_por uuid not null references public.profiles(id),
  criado_em timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_academy_cursos_ativos on public.academy_cursos(criado_em desc) where deleted_at is null;

-- 2. Questões (exatamente 10 por curso, validado na server action)
-- alternativas: jsonb array de strings, ex: ["A: opção 1", "B: opção 2", ...]
-- correta: índice 0..3 da alternativa correta
create table public.academy_questoes (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.academy_cursos(id) on delete cascade,
  ordem int not null check (ordem >= 1 and ordem <= 10),
  enunciado text not null check (length(trim(enunciado)) >= 1),
  alternativas jsonb not null check (jsonb_array_length(alternativas) = 4),
  correta int not null check (correta >= 0 and correta <= 3),
  unique (curso_id, ordem)
);

create index idx_academy_questoes_curso on public.academy_questoes(curso_id, ordem);

-- 3. Responsáveis (participantes obrigatórios atribuídos pelo criador)
create table public.academy_responsaveis (
  curso_id uuid not null references public.academy_cursos(id) on delete cascade,
  participante_id uuid not null references public.profiles(id) on delete cascade,
  atribuido_em timestamptz not null default now(),
  primary key (curso_id, participante_id)
);

create index idx_academy_responsaveis_participante on public.academy_responsaveis(participante_id);

-- 4. Tentativas (prova) — registra todas, mesmo as reprovadas
create table public.academy_tentativas (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.academy_cursos(id) on delete cascade,
  participante_id uuid not null references public.profiles(id) on delete cascade,
  -- respostas: jsonb array de int (índice escolhido por questão), tamanho 10
  respostas jsonb not null,
  acertos int not null check (acertos >= 0 and acertos <= 10),
  aprovado boolean not null,
  criado_em timestamptz not null default now()
);

create index idx_academy_tentativas_curso_user on public.academy_tentativas(curso_id, participante_id, criado_em desc);

-- View pra ranking: soma 100 pontos por curso aprovado (DISTINCT — só conta
-- a 1ª aprovação, não múltiplas tentativas aprovadas no mesmo curso).
create view public.academy_ranking as
select
  p.id as participante_id,
  p.nome,
  p.avatar_url,
  count(distinct t.curso_id) * 100 as pontos,
  count(distinct t.curso_id) as cursos_aprovados
from public.profiles p
left join public.academy_tentativas t
  on t.participante_id = p.id and t.aprovado = true
where p.ativo = true
group by p.id, p.nome, p.avatar_url;

-- RLS
alter table public.academy_cursos enable row level security;
alter table public.academy_questoes enable row level security;
alter table public.academy_responsaveis enable row level security;
alter table public.academy_tentativas enable row level security;

-- Cursos: todos autenticados leem (lista geral). Insert/update/delete via
-- server action com requirePermission — RLS aqui é defesa em profundidade
-- limitando ao próprio criador (sócio/coordenador via app).
create policy "auth read cursos" on public.academy_cursos
  for select to authenticated using (deleted_at is null);

create policy "auth insert cursos" on public.academy_cursos
  for insert to authenticated with check (criado_por = auth.uid());

create policy "criador updates cursos" on public.academy_cursos
  for update to authenticated using (criado_por = auth.uid())
  with check (criado_por = auth.uid());

-- Questões:
-- - SELECT: responsável OU criador OU privileged (adm/socio).
--   Importante: campo `correta` NUNCA é exposto pra responsável via API
--   pública — server action filtra. RLS aqui é leitura geral.
-- - INSERT/DELETE: criador do curso (via app).
create policy "membros read questoes" on public.academy_questoes
  for select to authenticated using (
    exists (
      select 1 from public.academy_cursos c
      where c.id = curso_id
        and (
          c.criado_por = auth.uid()
          or exists (
            select 1 from public.academy_responsaveis r
            where r.curso_id = c.id and r.participante_id = auth.uid()
          )
        )
    )
  );

create policy "criador insert questoes" on public.academy_questoes
  for insert to authenticated with check (
    exists (
      select 1 from public.academy_cursos c
      where c.id = curso_id and c.criado_por = auth.uid()
    )
  );

create policy "criador delete questoes" on public.academy_questoes
  for delete to authenticated using (
    exists (
      select 1 from public.academy_cursos c
      where c.id = curso_id and c.criado_por = auth.uid()
    )
  );

-- Responsáveis: leitura geral autenticada (qualquer um precisa saber se foi
-- atribuído); manage só o criador do curso.
create policy "auth read responsaveis" on public.academy_responsaveis
  for select to authenticated using (true);

create policy "criador insert responsavel" on public.academy_responsaveis
  for insert to authenticated with check (
    exists (
      select 1 from public.academy_cursos c
      where c.id = curso_id and c.criado_por = auth.uid()
    )
  );

create policy "criador delete responsavel" on public.academy_responsaveis
  for delete to authenticated using (
    exists (
      select 1 from public.academy_cursos c
      where c.id = curso_id and c.criado_por = auth.uid()
    )
  );

-- Tentativas:
-- - SELECT: o próprio participante OU o criador do curso (vê quem fez, nota).
-- - INSERT: o próprio participante; somente se for responsável daquele curso.
create policy "owner read tentativas" on public.academy_tentativas
  for select to authenticated using (
    participante_id = auth.uid()
    or exists (
      select 1 from public.academy_cursos c
      where c.id = curso_id and c.criado_por = auth.uid()
    )
  );

create policy "responsavel insert tentativa" on public.academy_tentativas
  for insert to authenticated with check (
    participante_id = auth.uid()
    and exists (
      select 1 from public.academy_responsaveis r
      where r.curso_id = curso_id and r.participante_id = auth.uid()
    )
  );

-- Sem update/delete em tentativas: histórico imutável.
