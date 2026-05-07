-- supabase/migrations/20260508000052_audiovisual_capturas.sql
-- Tabela pra registrar entregas de captação dos videomakers (link Drive,
-- quantidade, observações + feedback estruturado da gravação).
-- Os ratings também alimentam o sistema de satisfação do cliente.

create table public.audiovisual_capturas (
  id uuid primary key default gen_random_uuid(),
  -- Vínculo opcional ao evento de gravação (calendar_events sub_calendar='videomakers').
  -- Quando preenchido, o sistema usa pra calcular pendência/prazo (D+1 às 09h).
  event_id uuid references public.calendar_events(id) on delete set null,
  client_id uuid not null references public.clients(id) on delete cascade,
  videomaker_id uuid not null references public.profiles(id),

  -- Dados da entrega
  data_captacao date not null,
  drive_url text not null,
  qtd_videos integer not null default 0 check (qtd_videos >= 0),
  qtd_fotos integer not null default 0 check (qtd_fotos >= 0),
  observacoes text,

  -- Feedback estruturado (1-5 stars cada)
  rating_organizacao smallint check (rating_organizacao between 1 and 5),
  rating_facilidade smallint check (rating_facilidade between 1 and 5),
  rating_execucao_roteiro smallint check (rating_execucao_roteiro between 1 and 5),
  rating_atrasos smallint check (rating_atrasos between 1 and 5),
  rating_comunicacao smallint check (rating_comunicacao between 1 and 5),
  rating_retrabalho smallint check (rating_retrabalho between 1 and 5),
  rating_colaboracao smallint check (rating_colaboracao between 1 and 5),

  -- Texto livre do feedback
  pontos_positivos text,
  pontos_dificuldade text,
  sugestoes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_audiovisual_capturas_event on public.audiovisual_capturas(event_id);
create index idx_audiovisual_capturas_client on public.audiovisual_capturas(client_id);
create index idx_audiovisual_capturas_videomaker on public.audiovisual_capturas(videomaker_id, data_captacao desc);

-- Garantia: 1 captura por evento (evita duplicatas)
create unique index uq_audiovisual_capturas_event
  on public.audiovisual_capturas(event_id) where event_id is not null;

create trigger trg_audiovisual_capturas_updated_at
  before update on public.audiovisual_capturas
  for each row execute function public.set_updated_at();

alter table public.audiovisual_capturas enable row level security;

-- SELECT: amplo. Adm/sócio/coord/audiovisual_chefe/videomaker/editor/designer leem todas;
-- assessor lê só de clientes que assessora; videomaker autor sempre lê as suas.
create policy "audiovisual_capturas select"
  on public.audiovisual_capturas for select to authenticated
  using (
    public.current_user_role() in (
      'socio', 'adm', 'coordenador', 'audiovisual_chefe', 'videomaker', 'editor', 'designer'
    )
    or videomaker_id = auth.uid()
    or exists (
      select 1 from public.clients c
      where c.id = client_id
        and (c.assessor_id = auth.uid() or c.coordenador_id = auth.uid())
    )
  );

-- INSERT: só videomaker pode subir captura (e só pra si mesmo). Adm/sócio também
-- podem (correções/manutenção).
create policy "audiovisual_capturas insert"
  on public.audiovisual_capturas for insert to authenticated
  with check (
    videomaker_id = auth.uid()
    or public.current_user_role() in ('socio', 'adm', 'audiovisual_chefe')
  );

-- UPDATE: o autor (videomaker) ou adm/sócio/audiovisual_chefe.
create policy "audiovisual_capturas update"
  on public.audiovisual_capturas for update to authenticated
  using (
    videomaker_id = auth.uid()
    or public.current_user_role() in ('socio', 'adm', 'audiovisual_chefe')
  )
  with check (
    videomaker_id = auth.uid()
    or public.current_user_role() in ('socio', 'adm', 'audiovisual_chefe')
  );

-- DELETE: só sócio/adm.
create policy "audiovisual_capturas delete"
  on public.audiovisual_capturas for delete to authenticated
  using (public.current_user_role() in ('socio', 'adm'));
