-- D0 → D30 onboarding: estrutura por etapa pra cada cliente novo.
-- Quando cliente vira `status='ativo'`, trigger insere 9 etapas com o template
-- de fluxo + saídas. Idempotente — não duplica se já tem etapas.

create table public.client_onboarding_etapas (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  etapa_numero smallint not null check (etapa_numero between 1 and 9),
  etapa_codigo text not null,
  status text not null default 'pendente' check (status in ('pendente', 'em_progresso', 'concluido')),
  -- D0-relativo: 0 = mesmo dia, 30 = 30 dias depois. null pras etapas contínuas (8 e 9).
  dia_inicio_previsto smallint,
  dia_fim_previsto smallint,
  iniciado_em timestamptz,
  concluido_em timestamptz,
  concluido_por uuid references public.profiles(id),
  observacoes text,
  -- Snapshot do checklist no momento de criação (não muda quando template é alterado).
  -- Forma: [{label: text, done: bool, done_by: uuid|null, done_at: timestamptz|null}]
  fluxo_checklist jsonb not null default '[]'::jsonb,
  saidas_checklist jsonb not null default '[]'::jsonb,
  -- D0 do cliente — geralmente data_entrada, mas pode ser customizado no manual add.
  d0_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, etapa_codigo)
);

create index idx_onboarding_etapas_client on public.client_onboarding_etapas(client_id);
create index idx_onboarding_etapas_status on public.client_onboarding_etapas(status) where status != 'concluido';

create trigger trg_onboarding_etapas_updated_at
  before update on public.client_onboarding_etapas
  for each row execute function public.set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.client_onboarding_etapas enable row level security;

-- Adm/socio/coordenador veem tudo. Assessor/comercial: apenas clientes onde
-- são responsáveis. Service-role bypassa.
create policy "onboarding etapas select" on public.client_onboarding_etapas
  for select to authenticated
  using (
    public.current_user_role() in ('adm', 'socio', 'coordenador')
    or exists (
      select 1 from public.clients c
      where c.id = client_id
        and (c.assessor_id = auth.uid() or c.coordenador_id = auth.uid())
    )
  );

create policy "onboarding etapas insert" on public.client_onboarding_etapas
  for insert to authenticated
  with check (public.current_user_role() in ('adm', 'socio', 'coordenador'));

create policy "onboarding etapas update" on public.client_onboarding_etapas
  for update to authenticated
  using (
    public.current_user_role() in ('adm', 'socio', 'coordenador')
    or exists (
      select 1 from public.clients c
      where c.id = client_id
        and (c.assessor_id = auth.uid() or c.coordenador_id = auth.uid())
    )
  );

-- ─── Função de seed ──────────────────────────────────────────────────────────
-- Insere as 9 etapas pra um cliente, com template hardcoded. Idempotente:
-- ON CONFLICT DO NOTHING garante que não duplica se já existir.

create or replace function public.seed_client_onboarding_etapas(
  p_client_id uuid,
  p_d0_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.client_onboarding_etapas (
    client_id, etapa_numero, etapa_codigo, dia_inicio_previsto, dia_fim_previsto,
    fluxo_checklist, saidas_checklist, d0_date
  )
  values
    -- Etapa 1: Entrada do lead (D0-D2, Comercial)
    (p_client_id, 1, 'entrada', 0, 2,
      jsonb_build_array(
        jsonb_build_object('label', 'Apresenta proposta e fecha', 'done', false, 'done_by', null, 'done_at', null)
      ),
      jsonb_build_array(
        jsonb_build_object('label', 'Cliente fechado com escopo definido', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Informações claras para o ADM', 'done', false, 'done_by', null, 'done_at', null)
      ),
      p_d0_date),

    -- Etapa 2: Cadastro e organização (D3-D4, ADM)
    (p_client_id, 2, 'cadastro', 3, 4,
      jsonb_build_array(
        jsonb_build_object('label', 'Cadastro completo do cliente', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Inserção no CRM', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Registro de contrato', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Organização de pagamento (recorrência ou entrada)', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Criação de pasta/drive do cliente', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Marca a reunião de marco zero', 'done', false, 'done_by', null, 'done_at', null)
      ),
      jsonb_build_array(
        jsonb_build_object('label', 'Cliente 100% documentado', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Financeiro organizado', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Pronto para enviar ao Coordenador', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Reunião de marco zero agendada no sistema', 'done', false, 'done_by', null, 'done_at', null)
      ),
      p_d0_date),

    -- Etapa 3: Reunião marco zero + estratégia (D5-D7, Coordenador + Assessor)
    (p_client_id, 3, 'marco_zero', 5, 7,
      jsonb_build_array(
        jsonb_build_object('label', 'Agendamento da reunião (Cliente + Coordenador + Assessor)', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Reunião marco zero com cliente', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Alinhamento de expectativas', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Explicação de como funciona o processo', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Levantamento inicial de informações', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Entender profundamente o cliente', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Preencher material do briefing do cliente', 'done', false, 'done_by', null, 'done_at', null)
      ),
      jsonb_build_array(
        jsonb_build_object('label', 'Cliente seguro e alinhado', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Briefing estruturado', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Reunião de estratégia', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Estratégia clara', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Direcionamento para execução', 'done', false, 'done_by', null, 'done_at', null)
      ),
      p_d0_date),

    -- Etapa 4: Tráfego + estratégia (D7-D12, Assessor)
    (p_client_id, 4, 'trafego', 7, 12,
      jsonb_build_array(
        jsonb_build_object('label', 'Entender profundamente o cliente', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Subir campanha de tráfego', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Montar estratégia de tráfego', 'done', false, 'done_by', null, 'done_at', null)
      ),
      jsonb_build_array(
        jsonb_build_object('label', 'Estratégia clara', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Direcionamento para execução', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Tráfego ativo', 'done', false, 'done_by', null, 'done_at', null)
      ),
      p_d0_date),

    -- Etapa 5: Planejamento e produção (D13-D23, Coordenador + Time)
    (p_client_id, 5, 'producao', 13, 23,
      jsonb_build_array(
        jsonb_build_object('label', 'Assessor agenda gravações', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Assessor monta estratégia', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Time operacional executa captação', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Time operacional executa design', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Time operacional executa edição', 'done', false, 'done_by', null, 'done_at', null)
      ),
      jsonb_build_array(
        jsonb_build_object('label', 'Conteúdos prontos', 'done', false, 'done_by', null, 'done_at', null)
      ),
      p_d0_date),

    -- Etapa 6: Apresentação ao cliente (D24-D26, Assessor)
    (p_client_id, 6, 'apresentacao', 24, 26,
      jsonb_build_array(
        jsonb_build_object('label', 'Apresentar estratégia completa para o cliente', 'done', false, 'done_by', null, 'done_at', null)
      ),
      jsonb_build_array(
        jsonb_build_object('label', 'Conteúdo aprovado', 'done', false, 'done_by', null, 'done_at', null)
      ),
      p_d0_date),

    -- Etapa 7: Publicação + tráfego (D30, Assessor)
    (p_client_id, 7, 'publicacao', 30, 30,
      jsonb_build_array(
        jsonb_build_object('label', 'Postagem', 'done', false, 'done_by', null, 'done_at', null)
      ),
      jsonb_build_array(
        jsonb_build_object('label', 'Conteúdo rodando', 'done', false, 'done_by', null, 'done_at', null)
      ),
      p_d0_date),

    -- Etapa 8: Monitoramento e otimização (contínuo pós-D30, Assessor)
    (p_client_id, 8, 'monitoramento', null, null,
      jsonb_build_array(
        jsonb_build_object('label', 'Análise de métricas', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Ajustes em campanhas', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Ajustes em conteúdo', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Identificação de oportunidades', 'done', false, 'done_by', null, 'done_at', null)
      ),
      jsonb_build_array(
        jsonb_build_object('label', 'Melhoria contínua', 'done', false, 'done_by', null, 'done_at', null)
      ),
      p_d0_date),

    -- Etapa 9: Relacionamento contínuo (contínuo desde D5, Coordenador + Assessor)
    (p_client_id, 9, 'relacionamento', null, null,
      jsonb_build_array(
        jsonb_build_object('label', 'Acompanhamento do cliente', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Organização de demandas', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Gestão de agenda', 'done', false, 'done_by', null, 'done_at', null),
        jsonb_build_object('label', 'Controle de pagamentos recorrentes', 'done', false, 'done_by', null, 'done_at', null)
      ),
      jsonb_build_array(
        jsonb_build_object('label', 'Cliente ativo e satisfeito', 'done', false, 'done_by', null, 'done_at', null)
      ),
      p_d0_date)
  on conflict (client_id, etapa_codigo) do nothing;
end;
$$;

-- ─── Trigger: cliente vira ativo → seed etapas ────────────────────────────────

create or replace function public.trigger_seed_onboarding_on_ativo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Roda só na transição pra 'ativo' (insert ou update). Idempotente via
  -- ON CONFLICT na seed_function.
  if new.status = 'ativo' and (tg_op = 'INSERT' or old.status is distinct from 'ativo') then
    perform public.seed_client_onboarding_etapas(new.id, new.data_entrada);
  end if;
  return new;
end;
$$;

create trigger trg_seed_onboarding_ativo
  after insert or update of status on public.clients
  for each row execute function public.trigger_seed_onboarding_on_ativo();

comment on table public.client_onboarding_etapas is
  'Acompanhamento estruturado dos primeiros 30 dias do cliente. 9 etapas com '
  'checklists de fluxo (atividades) e saídas (entregáveis). Auto-criadas '
  'quando cliente vira status=ativo. Visualizado em /d0-d30.';
