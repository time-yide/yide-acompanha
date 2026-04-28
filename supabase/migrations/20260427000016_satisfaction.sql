-- supabase/migrations/20260427000016_satisfaction.sql

create type public.satisfaction_color as enum ('verde', 'amarelo', 'vermelho');

-- =============================================
-- satisfaction_entries (avaliação manual)
-- =============================================
create table public.satisfaction_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  autor_id uuid not null references public.profiles(id),
  papel_autor text not null,
  semana_iso text not null,
  cor public.satisfaction_color,
  comentario text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index uq_satisfaction_entries_client_autor_semana
  on public.satisfaction_entries(client_id, autor_id, semana_iso);

create index idx_satisfaction_entries_semana_cor
  on public.satisfaction_entries(semana_iso, cor);

create index idx_satisfaction_entries_autor_semana
  on public.satisfaction_entries(autor_id, semana_iso);

create trigger trg_satisfaction_entries_updated_at
  before update on public.satisfaction_entries
  for each row execute function public.set_updated_at();

alter table public.satisfaction_entries enable row level security;

-- SELECT: coord/socio/adm/produtores leem todas; assessor lê próprias + as do mesmo cliente onde é assessor;
-- comerciais não veem
create policy "satisfaction_entries select"
  on public.satisfaction_entries for select to authenticated
  using (
    public.current_user_role() in ('socio', 'adm', 'coordenador', 'audiovisual_chefe', 'videomaker', 'designer', 'editor')
    or autor_id = auth.uid()
    or exists (
      select 1 from public.clients c
      where c.id = client_id
        and (c.assessor_id = auth.uid() or c.coordenador_id = auth.uid())
    )
  );

-- UPDATE: só o autor da entry
create policy "satisfaction_entries update own"
  on public.satisfaction_entries for update to authenticated
  using (autor_id = auth.uid())
  with check (autor_id = auth.uid());

-- INSERT: o próprio user (criando manualmente) — service-role faz bootstrap dos pendentes
create policy "satisfaction_entries insert own"
  on public.satisfaction_entries for insert to authenticated
  with check (autor_id = auth.uid());

-- DELETE: só sócio
create policy "satisfaction_entries delete socio"
  on public.satisfaction_entries for delete to authenticated
  using (public.current_user_role() = 'socio');

-- =============================================
-- satisfaction_synthesis (síntese IA)
-- =============================================
create table public.satisfaction_synthesis (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  semana_iso text not null,
  score_final numeric(3,1) not null,
  cor_final public.satisfaction_color not null,
  resumo_ia text not null,
  divergencia_detectada boolean not null default false,
  acao_sugerida text,
  ai_input_hash text,
  ai_tokens_used integer,
  created_at timestamptz not null default now()
);

create unique index uq_satisfaction_synthesis_client_semana
  on public.satisfaction_synthesis(client_id, semana_iso);

create index idx_satisfaction_synthesis_semana_cor
  on public.satisfaction_synthesis(semana_iso, cor_final);

create index idx_satisfaction_synthesis_score
  on public.satisfaction_synthesis(semana_iso, score_final desc);

alter table public.satisfaction_synthesis enable row level security;

-- SELECT: todos autenticados (transparência da agência)
create policy "satisfaction_synthesis select all"
  on public.satisfaction_synthesis for select to authenticated using (true);

-- INSERT/UPDATE/DELETE: só service-role (sem policy = bloqueia para clients normais)
