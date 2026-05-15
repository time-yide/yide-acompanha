-- supabase/migrations/20260525000000_cursos_externos.sql
--
-- Sub-página "Cursos online" dentro do Yide Academy: catálogo de cursos
-- externos (Hotmart, Udemy, etc) com link de acesso + login/senha
-- compartilhados pra equipe usar.
--
-- Decisão de produto: armazena email/senha em texto puro. RLS restringe
-- leitura a colaboradores autenticados. NÃO é credencial de produção
-- crítica — são acessos pagos compartilhados pelo time. Pra credenciais
-- mais sensíveis, usar /clientes/credenciais que tem fluxo separado.

create table public.cursos_externos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  nome text not null,
  -- Plataforma livre — Hotmart, Udemy, Membro Plus, Coursera, Alura, etc.
  plataforma text not null,
  link text,
  email_acesso text,
  senha_acesso text,
  descricao text,
  criado_por uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_cursos_externos_org on public.cursos_externos(organization_id);
create index idx_cursos_externos_plataforma on public.cursos_externos(plataforma);

create trigger trg_cursos_externos_updated_at
  before update on public.cursos_externos
  for each row execute function public.set_updated_at();

alter table public.cursos_externos enable row level security;

-- SELECT: qualquer colaborador autenticado lê (catálogo da equipe).
create policy "cursos_externos read all auth"
  on public.cursos_externos for select to authenticated using (true);

-- INSERT: adm, sócio, coordenador (mesma permissão de criar treinamento na Academy).
create policy "cursos_externos insert privileged"
  on public.cursos_externos for insert to authenticated
  with check (
    public.current_user_role() in ('adm', 'socio', 'coordenador')
  );

-- UPDATE: adm, sócio, coordenador.
create policy "cursos_externos update privileged"
  on public.cursos_externos for update to authenticated
  using (
    public.current_user_role() in ('adm', 'socio', 'coordenador')
  )
  with check (
    public.current_user_role() in ('adm', 'socio', 'coordenador')
  );

-- DELETE: adm, sócio, coordenador.
create policy "cursos_externos delete privileged"
  on public.cursos_externos for delete to authenticated
  using (
    public.current_user_role() in ('adm', 'socio', 'coordenador')
  );
