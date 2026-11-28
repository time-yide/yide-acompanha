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

notify pgrst, 'reload schema';
