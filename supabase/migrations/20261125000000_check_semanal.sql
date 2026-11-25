-- Check semanal: check-in (segunda) e check-out (quinta) com cada assessor.
-- APLICAR MANUALMENTE no SQL Editor do Supabase.
-- Acesso só pelo servidor (service-role) com checagem de permissão no código;
-- RLS ligada sem policies = client (anon/authenticated) não lê nem escreve.

create table if not exists public.check_semanais (
  id uuid primary key default gen_random_uuid(),
  assessor_id uuid not null references public.profiles(id) on delete cascade,
  semana_inicio date not null,
  status text not null default 'aberto'
    check (status in ('aberto', 'processando', 'em_revisao', 'liberado', 'fechado')),
  meeting_id uuid references public.meetings(id) on delete set null,
  criado_por uuid references public.profiles(id) on delete set null,
  liberado_em timestamptz,
  liberado_por uuid references public.profiles(id) on delete set null,
  fechado_em timestamptz,
  fechado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessor_id, semana_inicio)
);

create index if not exists idx_check_semanais_semana on public.check_semanais (semana_inicio);
create index if not exists idx_check_semanais_meeting on public.check_semanais (meeting_id);

create table if not exists public.check_itens (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references public.check_semanais(id) on delete cascade,
  cliente_id uuid references public.clients(id) on delete set null,
  texto text not null check (length(trim(texto)) > 0),
  origem text not null default 'manual' check (origem in ('ia', 'manual', 'semana_anterior')),
  item_origem_id uuid references public.check_itens(id) on delete set null,
  citacao text,
  ordem int not null default 0,
  feito_assessor_em timestamptz,
  resultado text check (resultado in ('feito', 'nao_feito')),
  motivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_check_itens_check on public.check_itens (check_id);

alter table public.check_semanais enable row level security;
alter table public.check_itens enable row level security;

notify pgrst, 'reload schema';
