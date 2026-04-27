-- supabase/migrations/20260427000006_lead_history_attempts.sql

create table public.lead_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  from_stage public.lead_stage,
  to_stage public.lead_stage not null,
  ator_id uuid not null references public.profiles(id),
  observacao text,
  created_at timestamptz not null default now()
);

create index idx_lead_history_lead on public.lead_history(lead_id, created_at desc);

alter table public.lead_history enable row level security;

create policy "authenticated read lead_history"
  on public.lead_history for select to authenticated using (true);

create policy "authenticated insert lead_history"
  on public.lead_history for insert to authenticated
  with check (ator_id = auth.uid());

create type public.attempt_channel as enum ('whatsapp', 'email', 'ligacao', 'presencial', 'outro');
create type public.attempt_result as enum ('sem_resposta', 'agendou', 'recusou', 'pediu_proposta', 'outro');

create table public.lead_attempts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  autor_id uuid not null references public.profiles(id),
  canal public.attempt_channel not null default 'whatsapp',
  resultado public.attempt_result not null default 'sem_resposta',
  observacao text,
  proximo_passo text,
  data_proximo_passo date,
  created_at timestamptz not null default now()
);

create index idx_lead_attempts_lead on public.lead_attempts(lead_id, created_at desc);

alter table public.lead_attempts enable row level security;

create policy "authenticated read lead_attempts"
  on public.lead_attempts for select to authenticated using (true);

create policy "authenticated insert lead_attempts"
  on public.lead_attempts for insert to authenticated
  with check (autor_id = auth.uid());

create policy "author updates own lead_attempts"
  on public.lead_attempts for update to authenticated
  using (autor_id = auth.uid())
  with check (autor_id = auth.uid());

create policy "author or adm/socio delete lead_attempts"
  on public.lead_attempts for delete to authenticated
  using (autor_id = auth.uid() or public.current_user_role() in ('adm', 'socio'));
