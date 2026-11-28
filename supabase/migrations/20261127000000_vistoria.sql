-- Vistoria: estoque de equipamentos (câmeras, computadores, etc.) + conferência semanal
-- por QR code com cada videomaker/assessor.
-- APLICAR MANUALMENTE no SQL Editor do Supabase.
-- Acesso só pelo servidor (service-role) com checagem de permissão no código;
-- RLS ligada sem policies = client (anon/authenticated) não lê nem escreve.

create table if not exists public.equipamentos (
  id uuid primary key default gen_random_uuid(),
  -- Código gravado no QR code colado no equipamento (ex: YD-7K3QP2).
  codigo text not null unique check (length(trim(codigo)) > 0),
  nome text not null check (length(trim(nome)) > 0),
  categoria text not null default 'outro'
    check (categoria in ('computador', 'camera', 'lente', 'audio', 'iluminacao', 'suporte', 'armazenamento', 'acessorio', 'outro')),
  marca text,
  modelo text,
  numero_serie text,
  status text not null default 'ativo' check (status in ('ativo', 'manutencao', 'baixado')),
  -- Quem está com o equipamento. NULL = no estoque (guardado).
  responsavel_id uuid references public.profiles(id) on delete set null,
  observacao text,
  criado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_equipamentos_responsavel on public.equipamentos (responsavel_id);
create index if not exists idx_equipamentos_categoria on public.equipamentos (categoria);

create table if not exists public.vistorias (
  id uuid primary key default gen_random_uuid(),
  responsavel_id uuid not null references public.profiles(id) on delete cascade,
  semana_inicio date not null,
  concluida_em timestamptz,
  created_at timestamptz not null default now(),
  unique (responsavel_id, semana_inicio)
);

create table if not exists public.vistoria_leituras (
  id uuid primary key default gen_random_uuid(),
  vistoria_id uuid not null references public.vistorias(id) on delete cascade,
  equipamento_id uuid not null references public.equipamentos(id) on delete cascade,
  lida_em timestamptz not null default now(),
  unique (vistoria_id, equipamento_id)
);

create index if not exists idx_vistoria_leituras_vistoria on public.vistoria_leituras (vistoria_id);

alter table public.equipamentos enable row level security;
alter table public.vistorias enable row level security;
alter table public.vistoria_leituras enable row level security;


-- Foto do equipamento (bucket público, igual ao de recados: a URL final vai direto no registro).
alter table public.equipamentos add column if not exists foto_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vistoria-equipamentos', 'vistoria-equipamentos', true,
  10485760, array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "vistoria-equipamentos read"
  on storage.objects for select to authenticated
  using (bucket_id = 'vistoria-equipamentos');

-- Só gestores da Vistoria sobem foto (mesmos papéis de ROLES_GERENCIAM_VISTORIA).
create policy "vistoria-equipamentos insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'vistoria-equipamentos'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('adm', 'socio', 'audiovisual_chefe')
    )
  );

create policy "vistoria-equipamentos delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'vistoria-equipamentos' and owner = auth.uid());

-- Comprovação na conferência: quando ligada, cada leitura exige foto e estado do equipamento.
-- Desligada por padrão; só gestor liga.
create table if not exists public.vistoria_config (
  id int primary key default 1 check (id = 1),
  exigir_comprovacao boolean not null default false,
  -- Trava semanal: quem tem equipamento só usa o sistema depois de conferir. Desligada até a gestão ligar.
  trava_semanal_ativa boolean not null default false,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.profiles(id) on delete set null
);
insert into public.vistoria_config (id, exigir_comprovacao) values (1, false)
on conflict (id) do nothing;
alter table public.vistoria_config enable row level security;

alter table public.vistoria_leituras add column if not exists foto_url text;
alter table public.vistoria_leituras add column if not exists estado text
  check (estado in ('ok', 'defeito'));
alter table public.vistoria_leituras add column if not exists observacao text;

-- Quem confere sobe a própria foto, só dentro da pasta conferencia/<seu uid>/.
create policy "vistoria-equipamentos insert conferencia"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'vistoria-equipamentos'
    and (storage.foldername(name))[1] = 'conferencia'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

notify pgrst, 'reload schema';
