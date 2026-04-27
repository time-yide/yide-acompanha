-- supabase/migrations/20260427000007_calendar_events.sql
create type public.sub_calendar as enum ('agencia', 'onboarding', 'aniversarios');

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  titulo text not null,
  descricao text,
  inicio timestamptz not null,
  fim timestamptz not null,
  sub_calendar public.sub_calendar not null default 'agencia',
  criado_por uuid not null references public.profiles(id),
  participantes_ids uuid[] not null default array[]::uuid[],
  client_id uuid references public.clients(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_calendar_events_inicio on public.calendar_events(inicio);
create index idx_calendar_events_sub on public.calendar_events(sub_calendar);

create trigger trg_calendar_events_updated_at
  before update on public.calendar_events
  for each row execute function public.set_updated_at();

alter table public.calendar_events enable row level security;

create policy "authenticated read events"
  on public.calendar_events for select to authenticated using (true);

create policy "authenticated insert own events"
  on public.calendar_events for insert to authenticated
  with check (criado_por = auth.uid());

create policy "creator or adm/socio update events"
  on public.calendar_events for update to authenticated
  using (criado_por = auth.uid() or public.current_user_role() in ('adm', 'socio'))
  with check (criado_por = auth.uid() or public.current_user_role() in ('adm', 'socio'));

create policy "creator or adm/socio delete events"
  on public.calendar_events for delete to authenticated
  using (criado_por = auth.uid() or public.current_user_role() in ('adm', 'socio'));
