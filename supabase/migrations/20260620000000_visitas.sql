-- supabase/migrations/20260620000000_visitas.sql
-- Comercial Rua: visitas de rua + vínculo dos leads conseguidos nelas.

create table if not exists public.visitas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  colaborador_id uuid references public.profiles(id) on delete set null,
  data date not null,
  titulo text not null,
  bairro text,
  cidade text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  arquivado_em timestamptz
);

create index if not exists visitas_org_data_idx
  on public.visitas(organization_id, data desc) where arquivado_em is null;
create index if not exists visitas_colaborador_idx
  on public.visitas(colaborador_id) where arquivado_em is null;

drop trigger if exists visitas_set_updated_at on public.visitas;
create trigger visitas_set_updated_at
  before update on public.visitas
  for each row execute function public.set_updated_at();

alter table public.visitas enable row level security;
drop policy if exists visitas_select on public.visitas;
create policy visitas_select on public.visitas for select to authenticated using (true);
drop policy if exists visitas_insert on public.visitas;
create policy visitas_insert on public.visitas for insert to authenticated with check (true);
drop policy if exists visitas_update on public.visitas;
create policy visitas_update on public.visitas for update to authenticated using (true);

alter table public.leads_gerados
  add column if not exists visita_id uuid references public.visitas(id) on delete set null;
create index if not exists leads_gerados_visita_idx
  on public.leads_gerados(visita_id) where arquivado_em is null;

alter table public.leads_gerados drop constraint if exists leads_gerados_fonte_check;
alter table public.leads_gerados
  add constraint leads_gerados_fonte_check
  check (fonte in ('outscraper','apify','manual','visita'));
