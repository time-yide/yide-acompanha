-- supabase/migrations/20260426000005_audit_log.sql
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  entidade text not null,           -- nome da tabela (ex: 'profiles')
  entidade_id uuid not null,
  acao text not null,                -- 'create', 'update', 'soft_delete'
  dados_antes jsonb,
  dados_depois jsonb,
  ator_id uuid references auth.users(id),
  justificativa text,
  created_at timestamptz not null default now()
);

create index idx_audit_log_entidade on public.audit_log(entidade, entidade_id);
create index idx_audit_log_ator on public.audit_log(ator_id);
create index idx_audit_log_created_at on public.audit_log(created_at desc);

alter table public.audit_log enable row level security;

-- Apenas ADM e Sócio leem audit log
create policy "adm/socio can read audit log"
  on public.audit_log for select
  to authenticated
  using (public.current_user_role() in ('adm', 'socio'));

-- Qualquer autenticado pode inserir (server actions usam service_role então isso é defesa em profundidade)
create policy "authenticated can insert audit log"
  on public.audit_log for insert
  to authenticated
  with check (true);

-- Sem update/delete — log é imutável
