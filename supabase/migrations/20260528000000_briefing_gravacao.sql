-- supabase/migrations/20260528000000_briefing_gravacao.sql
--
-- Briefing & confirmação de gravação:
--  1. Tipa roteiro (link OU pdf, exclusivos)
--  2. Timestamps de leitura/impressão pelo videomaker designado
--  3. Idempotência de notificações 24h/3h/2h/sem-roteiro
--  4. Opt-in adm/sócio pra alerta de 2h
--  5. Bucket privado 'roteiros' + policies de upload/leitura
--  6. Novos eventos no enum notification_event + 4 notification_rules

-- 1) Roteiro tipado --------------------------------------------------------
alter table public.calendar_events
  add column roteiro_tipo text
    check (roteiro_tipo in ('link','pdf')),
  add column roteiro_pdf_path text;

-- Backfill: eventos existentes com link_roteiro preenchido viram tipo='link'
update public.calendar_events
   set roteiro_tipo = 'link'
 where link_roteiro is not null
   and link_roteiro <> '';

-- Consistência: se tipo='pdf', path obrigatório; se tipo='link', link obrigatório
alter table public.calendar_events
  add constraint calendar_events_roteiro_consistencia check (
    roteiro_tipo is null
    or (roteiro_tipo = 'link' and link_roteiro is not null and link_roteiro <> '')
    or (roteiro_tipo = 'pdf'  and roteiro_pdf_path is not null)
  );

-- 2) Confirmação pelo videomaker -------------------------------------------
alter table public.calendar_events
  add column videomaker_leu_em       timestamptz,
  add column briefing_gerado_em      timestamptz,
  add column videomaker_imprimiu_em  timestamptz,
  add column confirmacao_marcada_por uuid references public.profiles(id);

-- 3) Idempotência de notificações ------------------------------------------
alter table public.calendar_events
  add column notif_24h_enviada_em         timestamptz,
  add column notif_3h_enviada_em          timestamptz,
  add column notif_2h_alert_enviada_em    timestamptz,
  add column notif_sem_roteiro_enviada_em timestamptz;

-- Index parcial pro cron: só eventos de videomakers, futuros, pendentes em
-- qualquer um dos triggers. Reduz scan do cron de 5min.
create index idx_calendar_events_briefing_cron
  on public.calendar_events (inicio)
  where sub_calendar = 'videomakers'
    and (
      notif_24h_enviada_em is null
      or notif_3h_enviada_em is null
      or notif_2h_alert_enviada_em is null
      or notif_sem_roteiro_enviada_em is null
    );

-- 4) Opt-in adm/sócio -------------------------------------------------------
alter table public.profiles
  add column notif_alerta_gravacao_pendente boolean not null default true;

-- 5) Storage bucket --------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('roteiros', 'roteiros', false)
on conflict (id) do nothing;

-- Upload: assessor / coordenador / audiovisual_chefe / adm / sócio
create policy "roteiros_upload"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'roteiros'
    and (select role from public.profiles where id = auth.uid())
        in ('assessor','coordenador','audiovisual_chefe','adm','socio')
  );

-- Leitura: roles acima OU videomaker designado no evento dono do path
create policy "roteiros_read"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'roteiros'
    and (
      (select role from public.profiles where id = auth.uid())
          in ('assessor','coordenador','audiovisual_chefe','adm','socio')
      or exists (
        select 1
          from public.calendar_events e
         where e.roteiro_pdf_path = storage.objects.name
           and auth.uid() = any(e.participantes_ids)
      )
    )
  );

-- Delete: mesmas roles de upload
create policy "roteiros_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'roteiros'
    and (select role from public.profiles where id = auth.uid())
        in ('assessor','coordenador','audiovisual_chefe','adm','socio')
  );

-- 6) Enum + notification_rules ---------------------------------------------
alter type public.notification_event add value if not exists 'gravacao_pendente_24h';
alter type public.notification_event add value if not exists 'gravacao_pendente_3h';
alter type public.notification_event add value if not exists 'gravacao_alerta_2h';
alter type public.notification_event add value if not exists 'gravacao_sem_roteiro';

-- Rule: 24h pra videomaker (mandatory pro videomaker — sem opt-out)
insert into public.notification_rules (
  evento_tipo, ativo, mandatory, email_default,
  permite_destinatarios_extras, default_roles, default_user_ids
) values (
  'gravacao_pendente_24h', true, true, false,
  true, array[]::text[], array[]::uuid[]
) on conflict (evento_tipo) do nothing;

-- Rule: 3h pra videomaker
insert into public.notification_rules (
  evento_tipo, ativo, mandatory, email_default,
  permite_destinatarios_extras, default_roles, default_user_ids
) values (
  'gravacao_pendente_3h', true, true, false,
  true, array[]::text[], array[]::uuid[]
) on conflict (evento_tipo) do nothing;

-- Rule: 2h alert pra assessor + audiovisual_chefe (mandatory) + opt-in adm/sócio
-- Default_roles inclui audiovisual_chefe; destinatários extras (assessor criador,
-- adm/sócio com opt-in) entram via user_ids_extras na chamada do dispatch.
insert into public.notification_rules (
  evento_tipo, ativo, mandatory, email_default,
  permite_destinatarios_extras, default_roles, default_user_ids
) values (
  'gravacao_alerta_2h', true, true, false,
  true, array['audiovisual_chefe']::text[], array[]::uuid[]
) on conflict (evento_tipo) do nothing;

-- Rule: sem roteiro 24h antes — pra audiovisual_chefe + criador via extras
insert into public.notification_rules (
  evento_tipo, ativo, mandatory, email_default,
  permite_destinatarios_extras, default_roles, default_user_ids
) values (
  'gravacao_sem_roteiro', true, true, false,
  true, array['audiovisual_chefe']::text[], array[]::uuid[]
) on conflict (evento_tipo) do nothing;
