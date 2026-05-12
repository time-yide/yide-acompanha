-- =====================================================
-- DESIGN — FASE 1
-- Biblioteca de artes/criativos por cliente + style guide
-- (memória de gostos do cliente pra IA usar na Fase 2).
-- =====================================================

-- 1) Style guide por cliente — JSONB pra acomodar evolução sem migration
-- Estrutura esperada:
-- {
--   "paletas": ["#0EA5E9", "#10B981", ...],
--   "fontes_titulos": ["Poppins", "Montserrat"],
--   "fontes_corpo": ["Inter"],
--   "mood": "Minimalista, alto contraste, cores frias",
--   "tom_voz": "Direto, profissional, sem emojis",
--   "referencias": ["https://...", "https://..."],
--   "evitar": "Não usar tons de marrom, não fazer carrossel com mais de 8 slides",
--   "marca": "Logo branco em fundo escuro, sempre canto inferior direito",
--   "exemplos_aprovados": ["url1", "url2"]
-- }
alter table public.clients
  add column if not exists design_style_guide jsonb default '{}'::jsonb;

-- 2) Artes / criativos por cliente
create table if not exists public.design_artes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,

  titulo text not null,
  descricao text,
  formato text not null default 'feed' check (formato in ('feed','story','carrossel','reels','outro')),
  status text not null default 'rascunho'
    check (status in (
      'rascunho',           -- ideia inicial
      'em_producao',        -- sendo criada
      'aguardando_aprovacao', -- enviada pro cliente revisar
      'aprovado',           -- cliente aprovou
      'ajustes_solicitados',-- cliente pediu ajuste
      'agendado',           -- agendada pra postar (via Social Media)
      'publicado'           -- já foi ao ar
    )),

  -- Mídias: array de URLs (pode ser carrossel com várias imagens)
  midias jsonb not null default '[]'::jsonb,

  -- Texto pro post (legenda, hashtags) — vinculável pra Social Media depois
  copy text,
  hashtags text,

  -- Origem
  fonte_origem text not null default 'manual'
    check (fonte_origem in ('manual', 'ia_openai', 'ia_gemini', 'ia_flux', 'ia_ideogram')),
  ai_modelo text,           -- ex: 'dall-e-3', 'gpt-image-1', 'imagen-4', 'flux-pro-1.1'
  ai_prompt text,           -- prompt usado pra gerar
  ai_metadata jsonb,        -- response da API (revisões, parâmetros, custo)

  -- Aprovação
  aprovacao_token uuid unique default gen_random_uuid(),
  aprovado_em timestamptz,
  aprovado_por_email text,
  ajuste_observacoes text,

  -- Postagem (vincula com Social Media depois — Fase 1 do Design não publica)
  agendado_para timestamptz,
  publicado_em timestamptz,

  observacoes text,
  criado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists design_artes_client_idx
  on public.design_artes(client_id) where archived_at is null;
create index if not exists design_artes_status_idx
  on public.design_artes(status) where archived_at is null;
create index if not exists design_artes_org_idx
  on public.design_artes(organization_id);

-- updated_at trigger (set_updated_at já existe da migration de tráfego)
drop trigger if exists design_artes_set_updated_at on public.design_artes;
create trigger design_artes_set_updated_at
  before update on public.design_artes
  for each row execute function public.set_updated_at();

alter table public.design_artes enable row level security;

drop policy if exists design_artes_select on public.design_artes;
create policy design_artes_select on public.design_artes
  for select to authenticated using (true);

drop policy if exists design_artes_insert on public.design_artes;
create policy design_artes_insert on public.design_artes
  for insert to authenticated with check (true);

drop policy if exists design_artes_update on public.design_artes;
create policy design_artes_update on public.design_artes
  for update to authenticated using (true);

-- =====================================================
-- 3) Storage bucket pra criativos
-- =====================================================
-- Nome: design-criativos (privado, signed URLs).
-- Path padrão: {organization_id}/{client_id}/{arte_id}/{filename}
insert into storage.buckets (id, name, public)
  values ('design-criativos', 'design-criativos', false)
  on conflict (id) do nothing;

-- Policies do bucket: usuários autenticados podem ler/escrever no path da org deles
-- (simplificada na Fase 1; Fase 2 pode amarrar por organization_id)
drop policy if exists "design-criativos read authenticated" on storage.objects;
create policy "design-criativos read authenticated" on storage.objects
  for select to authenticated
  using (bucket_id = 'design-criativos');

drop policy if exists "design-criativos insert authenticated" on storage.objects;
create policy "design-criativos insert authenticated" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'design-criativos');

drop policy if exists "design-criativos update authenticated" on storage.objects;
create policy "design-criativos update authenticated" on storage.objects
  for update to authenticated
  using (bucket_id = 'design-criativos');

drop policy if exists "design-criativos delete authenticated" on storage.objects;
create policy "design-criativos delete authenticated" on storage.objects
  for delete to authenticated
  using (bucket_id = 'design-criativos');
