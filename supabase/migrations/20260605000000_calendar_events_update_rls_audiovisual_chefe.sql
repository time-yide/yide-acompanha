-- RLS de UPDATE em calendar_events ficou desatualizada: a policy original
-- (20260427000007_calendar_events.sql) só permite update pra `criado_por`,
-- `adm` e `socio`. Quando o fluxo de delegação de videomaker foi adicionado
-- (20260603000000), o `audiovisual_chefe` ficou de fora e o
-- `delegateVideomakerAction` falhava silenciosamente pro coord audiovisual
-- (Supabase não erra em RLS deny — só retorna 0 rows afetadas, e o action
-- mostrava toast de sucesso enganoso).
--
-- O app foi migrado pra usar service-role nesse UPDATE específico (auth
-- garantida via ROLES_COORD_DELEGATE no action), mas atualizamos a RLS
-- também como defesa em profundidade — qualquer caller futuro via client
-- cookie-based continua funcionando.

drop policy if exists "creator or adm/socio update events" on public.calendar_events;

create policy "creator or coord roles update events"
  on public.calendar_events for update to authenticated
  using (
    criado_por = auth.uid()
    or public.current_user_role() in ('adm', 'socio', 'audiovisual_chefe')
  )
  with check (
    criado_por = auth.uid()
    or public.current_user_role() in ('adm', 'socio', 'audiovisual_chefe')
  );

comment on policy "creator or coord roles update events" on public.calendar_events is
  'Quem pode editar evento: o próprio criador, adm, sócio ou coord audiovisual. '
  'Coord audiovisual precisa updatar pra delegar captação pra videomaker.';
