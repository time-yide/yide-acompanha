-- Materiais do Manual da Yide — arquivos que adm/sócio sobem pra equipe ver.
-- Casos de uso: modelo de briefing, decks de processos, manuais internos.

create table public.manual_materiais (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  storage_path text not null,                -- caminho no bucket (path único)
  mime_type text not null,
  size_bytes bigint not null,
  uploaded_by uuid not null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint chk_nome_not_empty check (length(trim(nome)) > 0)
);

create index idx_manual_materiais_created_at on public.manual_materiais(created_at desc);

alter table public.manual_materiais enable row level security;

-- Leitura: todo colaborador autenticado vê (manual é coletivo).
create policy "manual_materiais read"
  on public.manual_materiais for select to authenticated using (true);

-- Insert/update/delete: só adm/sócio mexem. App-layer também valida.
create policy "manual_materiais write"
  on public.manual_materiais for all to authenticated
  using (current_user_role() in ('adm'::user_role, 'socio'::user_role))
  with check (current_user_role() in ('adm'::user_role, 'socio'::user_role));

-- Storage bucket. Não-público pra arquivos serem servidos só via signed URL
-- via app — controle de acesso passa pela tabela acima (autenticado lê tudo).
insert into storage.buckets (id, name, public)
values ('manual-materiais', 'manual-materiais', false)
on conflict (id) do nothing;

create policy "manual-materiais read"
  on storage.objects for select to authenticated
  using (bucket_id = 'manual-materiais');

create policy "manual-materiais write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'manual-materiais'
    and current_user_role() in ('adm'::user_role, 'socio'::user_role)
  );

create policy "manual-materiais delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'manual-materiais'
    and current_user_role() in ('adm'::user_role, 'socio'::user_role)
  );
