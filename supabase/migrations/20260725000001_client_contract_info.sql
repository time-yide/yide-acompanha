-- "Informações para contrato" preenchidas pelo cliente no portal e vistas em
-- Financeiro › Contratos. Um registro por cliente (PK = client_id), editável.
create table if not exists public.client_contract_info (
  client_id uuid primary key references public.clients(id) on delete cascade,
  razao_social text,
  cnpj_cpf text,
  endereco text,
  email text,
  telefone text,
  updated_at timestamptz not null default now()
);

alter table public.client_contract_info enable row level security;

-- Acesso é sempre via service-role (portal action + queries do financeiro), que
-- ignora RLS. Sem policies permissivas: nada de acesso direto por usuário logado.
