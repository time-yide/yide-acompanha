-- supabase/migrations/20260709000200_agenda_bloqueios.sql
-- Solicitações de bloqueio de agenda do videomaker (1 dia + faixa de horário),
-- aprovadas/recusadas pelo coordenador audiovisual.

create table public.agenda_bloqueios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),

  criado_por uuid not null references public.profiles(id),
  criado_por_nome text not null,

  data date not null,
  hora_inicio time not null,
  hora_fim time not null,
  motivo text not null,

  status text not null default 'pendente'
    check (status in ('pendente', 'aprovada', 'rejeitada')),
  respondido_por uuid references public.profiles(id) on delete set null,
  respondido_em timestamptz,
  motivo_recusa text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),

  constraint agenda_bloqueios_horario_valido check (hora_fim > hora_inicio)
);

create index idx_agenda_bloqueios_criado_por on public.agenda_bloqueios(criado_por);
create index idx_agenda_bloqueios_status on public.agenda_bloqueios(status);
create index idx_agenda_bloqueios_data on public.agenda_bloqueios(data);
create index idx_agenda_bloqueios_deleted on public.agenda_bloqueios(deleted_at)
  where deleted_at is not null;

create trigger trg_agenda_bloqueios_updated_at
  before update on public.agenda_bloqueios
  for each row execute function public.set_updated_at();

alter table public.agenda_bloqueios enable row level security;

create policy "agenda_bloqueios select"
  on public.agenda_bloqueios for select to authenticated
  using (
    criado_por = auth.uid()
    or public.current_user_role() in ('adm', 'socio', 'audiovisual_chefe', 'coordenador')
  );

create policy "agenda_bloqueios insert"
  on public.agenda_bloqueios for insert to authenticated
  with check (
    criado_por = auth.uid()
    or public.current_user_role() in ('adm', 'socio')
  );

create policy "agenda_bloqueios update"
  on public.agenda_bloqueios for update to authenticated
  using (
    (criado_por = auth.uid() and status = 'pendente')
    or public.current_user_role() in ('audiovisual_chefe', 'adm', 'socio')
  )
  with check (
    (criado_por = auth.uid())
    or public.current_user_role() in ('audiovisual_chefe', 'adm', 'socio')
  );

create policy "agenda_bloqueios delete"
  on public.agenda_bloqueios for delete to authenticated
  using (public.current_user_role() in ('adm', 'socio'));

-- Regras de notificação (o dispatch faz no-op se a regra não existir).
insert into public.notification_rules
  (evento_tipo, ativo, mandatory, email_default, permite_destinatarios_extras, default_roles)
values
  ('bloqueio_agenda_solicitado', true, false, true,  true, array['audiovisual_chefe']),
  ('bloqueio_agenda_respondido', true, false, false, true, array[]::text[])
on conflict (evento_tipo) do nothing;
