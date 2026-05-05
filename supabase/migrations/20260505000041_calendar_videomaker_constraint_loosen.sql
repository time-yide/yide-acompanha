-- supabase/migrations/20260505000041_calendar_videomaker_constraint_loosen.sql
-- Afrouxa a constraint chk_videomaker_required_fields: agora apenas
-- localizacao_endereco é obrigatório quando sub_calendar = 'videomakers'.
-- Maps e roteiro voltam a ser opcionais — fluxo: quem cria o evento
-- preenche o endereço; videomaker complementa maps/roteiro depois.
--
-- A constraint anterior exigia os 3 campos, mas a UI e o schema Zod
-- sempre trataram maps e roteiro como opcionais, então nenhum evento
-- de videomaker conseguia ser criado.

alter table public.calendar_events
  drop constraint if exists chk_videomaker_required_fields;

alter table public.calendar_events
  add constraint chk_videomaker_required_fields
  check (
    sub_calendar::text <> 'videomakers'
    or (
      localizacao_endereco is not null
      and length(trim(localizacao_endereco)) > 0
    )
  );
