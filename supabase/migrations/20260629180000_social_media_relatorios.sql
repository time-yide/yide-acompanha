-- Relatório de Redes Sociais por cliente (PDF + portal). Espelha trafego_relatorios.
create table if not exists public.social_media_relatorios (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clients(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  periodo_inicio date not null,
  periodo_fim date not null,
  dados jsonb not null default '{}'::jsonb,
  status text not null default 'rascunho' check (status in ('rascunho','gerando','pronta','erro')),
  pdf_storage_path text,
  publicado_em timestamptz,
  criado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_relatorios_cliente_idx
  on public.social_media_relatorios (cliente_id, periodo_inicio desc);
create index if not exists social_relatorios_publicado_idx
  on public.social_media_relatorios (cliente_id, publicado_em desc)
  where publicado_em is not null;

alter table public.social_media_relatorios enable row level security;

-- Interno: equipe autenticada gerencia.
drop policy if exists social_relatorios_interno on public.social_media_relatorios;
create policy social_relatorios_interno on public.social_media_relatorios
  for all to authenticated using (true) with check (true);

-- Portal do cliente: só relatórios publicados do próprio cliente.
drop policy if exists social_relatorios_portal on public.social_media_relatorios;
create policy social_relatorios_portal on public.social_media_relatorios
  for select to authenticated
  using (
    publicado_em is not null
    and cliente_id = ((auth.jwt() -> 'user_metadata' ->> 'client_id')::uuid)
  );

-- Bucket dos PDFs.
insert into storage.buckets (id, name, public)
  values ('relatorios-redes-sociais', 'relatorios-redes-sociais', false)
  on conflict (id) do nothing;
drop policy if exists "relatorios-rs read" on storage.objects;
create policy "relatorios-rs read" on storage.objects
  for select to authenticated using (bucket_id = 'relatorios-redes-sociais');
drop policy if exists "relatorios-rs write" on storage.objects;
create policy "relatorios-rs write" on storage.objects
  for insert to authenticated with check (bucket_id = 'relatorios-redes-sociais');
