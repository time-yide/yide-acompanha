-- Apresenta Yide — apresentações geradas por IA com visual fixo Yide.
-- Slides ficam como JSONB; PDF é gerado on-demand e salvo no Storage.

create table public.apresentacoes_yide (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  prompt text not null,
  objetivo text,
  num_slides_alvo integer not null default 8,
  slides jsonb not null default '[]'::jsonb,
  status text not null default 'rascunho',
  pdf_storage_path text,
  criado_por uuid not null references public.profiles(id) on delete set null,
  organization_id uuid not null references public.organizations(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_titulo_not_empty check (length(trim(titulo)) > 0),
  constraint chk_num_slides_range check (num_slides_alvo between 5 and 15),
  constraint chk_status_valid check (status in ('rascunho', 'gerando', 'pronta', 'erro'))
);

create index idx_apresentacoes_yide_criado_por on public.apresentacoes_yide(criado_por);
create index idx_apresentacoes_yide_created_at on public.apresentacoes_yide(created_at desc);

create trigger trg_apresentacoes_yide_touch
  before update on public.apresentacoes_yide
  for each row execute function public.set_updated_at();

alter table public.apresentacoes_yide enable row level security;

create policy "apresentacoes_yide read"
  on public.apresentacoes_yide for select to authenticated using (
    criado_por = auth.uid()
    or current_user_role() in ('adm'::user_role, 'socio'::user_role)
  );

create policy "apresentacoes_yide write own"
  on public.apresentacoes_yide for all to authenticated
  using (criado_por = auth.uid())
  with check (criado_por = auth.uid());

-- Bucket privado pra PDFs
insert into storage.buckets (id, name, public)
values ('apresentacoes-yide', 'apresentacoes-yide', false)
on conflict (id) do nothing;

create policy "apresentacoes-yide bucket read"
  on storage.objects for select to authenticated
  using (bucket_id = 'apresentacoes-yide');

create policy "apresentacoes-yide bucket write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'apresentacoes-yide');

create policy "apresentacoes-yide bucket delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'apresentacoes-yide');
