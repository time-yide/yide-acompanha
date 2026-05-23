-- Tutoriais em vídeo do Manual da Yide — "Passo a passo do sistema".
-- Vídeos (gerados por IA ou tutoriais gravados) organizados por setor/role,
-- ensinando cada perfil a usar o sistema. Adm/sócio cadastra; equipe consome.
--
-- Decisão: vídeos são externos (YouTube/Vimeo/Loom) em vez de upload direto
-- — diminui custo de storage e aproveita players otimizados.

create table public.manual_tutoriais (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  /** Setor/papel pra agrupar. Usa user_role pra cobrir todas as roles do app.
      Null = tutorial genérico (visível em todas as seções). */
  setor public.user_role,
  /** URL do vídeo embedável (YouTube, Vimeo, Loom). App detecta a plataforma
      e renderiza iframe apropriado. */
  video_url text not null,
  /** Ordem dentro do setor (menor = primeiro). Empate desempata por created_at. */
  ordem integer not null default 0,
  uploaded_by uuid not null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_titulo_not_empty check (length(trim(titulo)) > 0),
  constraint chk_url_not_empty check (length(trim(video_url)) > 0)
);

create index idx_manual_tutoriais_setor_ordem on public.manual_tutoriais(setor, ordem, created_at);

create trigger trg_manual_tutoriais_updated_at
  before update on public.manual_tutoriais
  for each row execute function public.set_updated_at();

alter table public.manual_tutoriais enable row level security;

-- Leitura: todo colaborador autenticado vê (manual é coletivo).
create policy "manual_tutoriais read"
  on public.manual_tutoriais for select to authenticated using (true);

-- Insert/update/delete: só adm/sócio. App-layer também valida.
create policy "manual_tutoriais write"
  on public.manual_tutoriais for all to authenticated
  using (current_user_role() in ('adm'::user_role, 'socio'::user_role))
  with check (current_user_role() in ('adm'::user_role, 'socio'::user_role));
