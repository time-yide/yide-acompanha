-- supabase/migrations/20260501000028_calendar_videomaker_fields.sql
-- Campos extras pro sub_calendar 'videomakers': localização (texto + maps url),
-- link do roteiro e observações da gravação. Os 3 primeiros são obrigatórios
-- quando sub_calendar = 'videomakers'.

alter table public.calendar_events
  add column if not exists localizacao_endereco text,
  add column if not exists localizacao_maps_url text,
  add column if not exists link_roteiro text,
  add column if not exists observacoes_gravacao text;

-- Quando o evento é de videomaker, os 3 campos críticos não podem ser nulos/vazios.
-- Casting via ::text evita problemas de cast direto pro enum em CHECK.
alter table public.calendar_events
  add constraint chk_videomaker_required_fields
  check (
    sub_calendar::text <> 'videomakers'
    or (
      localizacao_endereco is not null and length(trim(localizacao_endereco)) > 0
      and localizacao_maps_url is not null and length(trim(localizacao_maps_url)) > 0
      and link_roteiro is not null and length(trim(link_roteiro)) > 0
    )
  );
