# Fase 11 — Painel Mensal do Assessor — Design Spec

**Status:** Aprovado em 2026-04-28
**Plano anterior:** Fase 10 — Prospecção (mergeado em main, commit `27b6b81`)

## 1. Objetivo

Migrar a planilha mensal Excel/Google Sheets dos assessores para uma página `/painel` no sistema. Cada cliente vira uma linha com 11 etapas mensais (cronograma, design, tráfego, gravações, edição, postagem, reunião). O sistema delega automaticamente etapas para os responsáveis quando a anterior fica pronta (auto-cadeia), dispara notificações e detecta atrasos com base em prazos D-X relativos ao primeiro dia do mês.

Nada de upload de arquivos no sistema — todos os arquivos ficam no Drive (1 link por cliente).

## 2. Escopo

### 2.1 Dentro do escopo

- Adicionar 7 campos em `clients` (3 FKs + 3 URLs + 1 número padrão)
- 2 tabelas novas: `client_monthly_checklist` (1 linha por cliente por mês) + `checklist_step` (11 linhas por checklist, uma por etapa)
- 11 etapas mapeadas: `cronograma`, `design`, `tpg`, `tpm`, `valor_trafego`, `gmn_post`, `camera`, `mobile`, `edicao`, `reuniao`, `postagem`
- Cadeia principal sequencial com auto-delegação: cronograma → design → câmera+mobile → edição → postagem
- Etapas paralelas (TPG, TPM, valor, GMN, reunião) — não bloqueiam outras, mas notificam Coord/Sócios quando prontas
- Cron mensal (plugado no `daily-digest` existente) que cria checklist novo todo dia 1 do mês
- Cron diário (mesmo `daily-digest`) que marca etapas atrasadas e dispara notificações
- Histórico mantido (todos os meses anteriores acessíveis)
- Página `/painel` estilo planilha com permissões por papel
- Form `/clientes/[id]/editar` ganha 7 novos campos
- Reusa sistema de notificações (Fase 6) com novo evento `checklist_step_delegada` e `checklist_step_atrasada`

### 2.2 Fora do escopo

- Pipeline de Onboarding D0-D30 da entrada inicial de cliente novo → Fase 12 (futuro)
- Customização de prazos D-X por cliente — prazos hardcoded por enquanto
- Anexos diretos no sistema (todos arquivos vão pro Drive)
- Importação automática da planilha Excel atual — migração manual
- Notificações por email pra etapas (só in-app por enquanto — mas Fase 6 já permite ativar email se quiser depois)
- Drilldown / análise de tempos médios de execução por etapa → futuro

## 3. Arquitetura

### 3.1 Migrações

**Migração 1 — adicionar campos em `clients`:**

```sql
alter table public.clients
  add column if not exists designer_id uuid references public.profiles(id),
  add column if not exists videomaker_id uuid references public.profiles(id),
  add column if not exists editor_id uuid references public.profiles(id),
  add column if not exists instagram_url text,
  add column if not exists gmn_url text,
  add column if not exists drive_url text,
  add column if not exists pacote_post_padrao integer;
```

Sem default. RLS existente cobre UPDATE (Assessor do cliente, Coord, Sócio, ADM).

**Migração 2 — criar tabelas de checklist:**

```sql
-- Enum de status
create type public.checklist_step_status as enum (
  'pendente',
  'em_andamento',
  'pronto',
  'atrasada'
);

-- Enum de etapa
create type public.checklist_step_key as enum (
  'cronograma',
  'design',
  'tpg',
  'tpm',
  'valor_trafego',
  'gmn_post',
  'camera',
  'mobile',
  'edicao',
  'reuniao',
  'postagem'
);

-- Tabela de checklist mensal por cliente
create table public.client_monthly_checklist (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mes_referencia text not null,           -- 'YYYY-MM'
  pacote_post integer,                    -- copia do client.pacote_post_padrao no momento da criação
  quantidade_postada integer,             -- manual, atualizada pelo assessor
  valor_trafego_mes numeric(12,2),        -- input no campo R$
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(client_id, mes_referencia)
);

-- Tabela de etapas do checklist
create table public.checklist_step (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.client_monthly_checklist(id) on delete cascade,
  step_key public.checklist_step_key not null,
  status public.checklist_step_status not null default 'pendente',
  responsavel_id uuid references public.profiles(id),
  iniciado_em timestamptz,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id),
  unique(checklist_id, step_key)
);

-- Índices
create index idx_checklist_client_mes on public.client_monthly_checklist(client_id, mes_referencia);
create index idx_checklist_mes on public.client_monthly_checklist(mes_referencia);
create index idx_step_checklist on public.checklist_step(checklist_id);
create index idx_step_responsavel on public.checklist_step(responsavel_id, status) where status != 'pronto';

-- RLS
alter table public.client_monthly_checklist enable row level security;
alter table public.checklist_step enable row level security;

create policy "checklist select"
  on public.client_monthly_checklist for select to authenticated
  using (true);  -- Filtros aplicados via queries (papel-específicos)

create policy "checklist update by assessor/coord/socio/adm"
  on public.client_monthly_checklist for update to authenticated
  using (
    public.current_user_role() in ('socio', 'adm', 'coordenador') OR
    exists (
      select 1 from public.clients c
      where c.id = client_id AND c.assessor_id = auth.uid()
    )
  );

create policy "step select"
  on public.checklist_step for select to authenticated using (true);

create policy "step update own or admin"
  on public.checklist_step for update to authenticated
  using (
    public.current_user_role() in ('socio', 'adm', 'coordenador') OR
    responsavel_id = auth.uid()
  );

-- INSERT: só service-role (cron) — sem policy de INSERT pra usuários comuns
```

**Migração 3 — adicionar evento de notificação:**

```sql
alter type public.notification_event add value if not exists 'checklist_step_delegada';
alter type public.notification_event add value if not exists 'checklist_step_atrasada';
alter type public.notification_event add value if not exists 'checklist_step_concluida';
```

E inserir nas `notification_rules` os defaults (segue padrão da Fase 6).

### 3.2 Prazos D-X por etapa (hardcoded)

Em `src/lib/painel/deadlines.ts`:

```ts
export const STEP_DEADLINES: Record<StepKey, number> = {
  cronograma: 7,
  tpg: 12,
  tpm: 12,
  valor_trafego: 12,
  design: 23,
  camera: 23,
  mobile: 23,
  edicao: 23,
  gmn_post: 26,
  reuniao: 26,
  postagem: 30,
};
```

Função `isAtrasada(stepKey, status, today)`: retorna true se `today.getDate() > STEP_DEADLINES[stepKey]` e `status != 'pronto'`.

### 3.3 Cadeia de delegação

Em `src/lib/painel/chain.ts`:

```ts
// Próxima etapa quando uma fica pronta
export const NEXT_IN_CHAIN: Partial<Record<StepKey, { next: StepKey; resolveResponsavel: (client: ClientRow) => string | null }>> = {
  cronograma: {
    next: "design",
    resolveResponsavel: (c) => c.designer_id,
  },
  design: {
    next: "camera", // dispara camera e mobile em paralelo
    resolveResponsavel: (c) => c.videomaker_id,
  },
  // camera e mobile não disparam direto edição — precisa dos DOIS prontos
  // edicao só destrava quando camera+mobile prontos (lógica especial)
  edicao: {
    next: "postagem",
    resolveResponsavel: (c) => c.assessor_id,
  },
};
```

**Caso especial — Edição precisa de Camera+Mobile prontos:**
Quando camera ou mobile fica pronto, sistema verifica se ambos estão. Se sim, delega edição pro `client.editor_id`. Se não, fica em pendente.

**Etapas paralelas (não desbloqueiam ninguém, só notificam):**
- `tpg`, `tpm`, `valor_trafego`, `gmn_post`, `reuniao`
- Quando ficam prontas → notifica Coord+Sócios+ADM (mas não muda outras etapas)

### 3.4 Server actions

`src/lib/painel/actions.ts`:

```ts
// Marcar etapa como pronta
markStepPronto(stepId): Promise<ActionResult>

// Atualizar campos numéricos do checklist (pacote_post, quantidade_postada, valor_trafego_mes)
updateChecklistField(checklistId, field, value): Promise<ActionResult>

// Definir responsável manual (caso designer/videomaker/editor não esteja set no cliente)
setStepResponsavel(stepId, profileId): Promise<ActionResult>
```

Ao marcar pronto:
1. Set `status='pronto'`, `completed_at=now()`, `completed_by=user.id`
2. Se for etapa da cadeia principal e tem `next`, criar/atualizar próxima etapa:
   - `responsavel_id` = resolve do cliente
   - Se responsavel_id é null → notifica Coord "Defina <tipo> pra cliente <nome>"
   - Senão → notifica responsável "Etapa <X> delegada pra você"
   - Status = `em_andamento`, `iniciado_em = now()`
3. Se for paralela → notifica Coord+Sócios+ADM (evento `checklist_step_concluida`)

### 3.5 Cron — reset mensal e detector de atrasos

Em `src/lib/cron/detectors/checklist-monthly.ts`:

```ts
export async function detectChecklistMonthly(counters: { ... }): Promise<void> {
  const today = new Date();
  
  // Dia 1 do mês: criar checklists novos
  if (today.getUTCDate() === 1) {
    await createChecklistsForActiveClients();
  }
  
  // Sempre: detectar atrasos
  await markAtrasadas();
}
```

`createChecklistsForActiveClients`:
- Lista todos clientes ativos
- Para cada cliente, cria 1 `client_monthly_checklist` com `mes_referencia` = mes corrente
- Cria 11 `checklist_step` com status='pendente'
- Atualiza step `cronograma`: `responsavel_id = client.assessor_id`, status='em_andamento', dispara notificação pro assessor
- Idempotente: se já existe checklist pro mês, não cria de novo (UNIQUE constraint)

`markAtrasadas`:
- Lista todos `checklist_step` com status != 'pronto' AND `mes_referencia` = mes corrente
- Para cada um: se `today.getDate() > STEP_DEADLINES[step_key]` e status != 'atrasada', marca como `atrasada` e dispara notificação `checklist_step_atrasada` pro responsável + coord+sócio

Plugado no `daily-digest` cron (Fase 6) com `safeDetect()`.

### 3.6 UI — Página `/painel`

**Layout:**

```
[Header]
"Painel mensal" · Mês: [Maio/2026 ▼] · Comercial: [Filter dropdown — só Sócio/ADM/Coord]

[Tabela tipo planilha]
| Cliente | Pacote/Post | Crono | Design | TPG | TPM | R$ | GM | Câmera | Mobile | Edição | Reunião | Postagem | Drive |
| Laricas |  12 / 8     |  🟢   |  🟡    | 🟢  | 🟢  |2k  | 🟢 |  🔴   |  🔴   |  ⚪   |  ⚪    |  ⚪      | 🔗   |
```

**Códigos visuais:**
- ⚪ pendente (cinza)
- 🟡 em_andamento (amarelo)
- 🟢 pronto (verde)
- 🔴 atrasada (vermelho)

**Interação por célula:**
- Clique na célula → modal pequeno com:
  - Status atual
  - Responsável atual
  - Histórico (iniciado em / completed at / by)
  - Botão "Marcar como pronto" (visível só se user é responsável OU coord/sócio/adm)
  - (Se é a etapa `valor_trafego` ou `quantidade_postada`) campo de input numérico inline

**Filtros do header:**
- Mês (default = atual, dropdown últimos 12 meses)
- Comercial/Assessor (só Sócio/ADM/Coord)

**Permissões da view:**
- Assessor: vê só `where assessor_id = user.id`
- Coordenador: vê `where coordenador_id = user.id`
- Designer: vê só clientes onde `designer_id = user.id`
- Videomaker: vê só onde `videomaker_id = user.id`
- Editor: vê só onde `editor_id = user.id`
- Sócio/ADM: vê todos com filtro
- Comercial: não acessa (404)

**Permissões pra marcar pronto cada etapa:**
- `cronograma` → assessor do cliente, coord, sócio, adm
- `design` → designer do cliente, coord, sócio, adm
- `camera`, `mobile` → videomaker do cliente, coord, sócio, adm
- `edicao` → editor do cliente, coord, sócio, adm
- `tpg`, `tpm`, `valor_trafego`, `gmn_post`, `postagem` → assessor do cliente, coord, sócio, adm
- `reuniao` → assessor OU coord do cliente, sócio, adm

### 3.7 Sidebar

Adicionar item "Painel mensal" → `/painel` na sidebar, visível para:
`adm, socio, coordenador, assessor, designer, videomaker, editor, audiovisual_chefe` (todos exceto comercial).

### 3.8 Form `/clientes/[id]/editar`

Adicionar nova seção "Equipe e links" no form, com 7 campos:
- Designer (dropdown role=designer)
- Videomaker (dropdown role=videomaker)
- Editor (dropdown role=editor)
- Instagram (input URL)
- Google Meu Negócio (input URL)
- Drive (input URL)
- Pacote padrão de posts/mês (input number)

Editáveis por: assessor do cliente, coord do cliente, sócio, adm.

### 3.9 Reuso da Fase 6 (notificações)

Adicionar 3 eventos novos no enum `notification_event`:
- `checklist_step_delegada` — quando etapa é delegada (em_andamento + responsavel_id set)
- `checklist_step_atrasada` — quando vira atrasada
- `checklist_step_concluida` — quando paralela é marcada pronta (notifica Coord/Sócios)

Inserir defaults em `notification_rules` (canal in-app por padrão, configurável por papel via `/configuracoes/notificacoes` que já existe).

## 4. Considerações não-funcionais

### 4.1 Performance

- Painel mensal carrega todos os clientes do user com JOIN nos steps (LEFT JOIN). Pra Yide com até 200 clientes, 11 steps cada → 2200 rows. Aceitável.
- Cron diário detector de atrasos: ~200 clients × 11 steps = 2200 rows pra varrer. Trivial.
- Cron mensal: cria 200 + 2200 rows uma vez. Aceitável.

### 4.2 Idempotência do cron

- Reset mensal: UNIQUE constraint em `(client_id, mes_referencia)` previne duplicatas se o cron rodar 2x no mesmo dia.
- Detector de atrasos: idempotente — só atualiza se status mudaria.

### 4.3 Mobile

- Tabela larga vira scrollable horizontal em mobile (já é o padrão do projeto).
- Modal de etapa funciona bem em mobile.

## 5. Tests

### 5.1 Unit (TDD onde aplicável)

`tests/unit/painel-deadlines.test.ts`:
- `isAtrasada` retorna true se hoje > deadline e status != pronto
- `isAtrasada` retorna false se status = pronto
- `isAtrasada` respeita prazo por etapa

`tests/unit/painel-actions.test.ts`:
- `markStepPronto` atualiza status, completed_at, completed_by
- `markStepPronto` em cronograma → cria/atualiza design com responsavel = designer do cliente
- `markStepPronto` em camera quando mobile já pronto → dispara edição
- `markStepPronto` em paralela (tpg) → notifica Coord/Sócios sem criar próxima etapa
- `updateChecklistField` valida tipos (number) e atualiza
- `setStepResponsavel` só permitido para Coord/Sócio/ADM

`tests/unit/painel-cron.test.ts`:
- Reset mensal cria 1 checklist + 11 steps por cliente ativo
- Reset mensal é idempotente (não duplica)
- Detector marca steps atrasadas baseado em prazo
- Detector dispara notificação `checklist_step_atrasada`

Total: ~12 testes novos.

### 5.2 E2E

Auth-redirect tests pra `/painel`. ~1 teste novo.

## 6. Plano de execução resumido (~17 commits)

- A1: migration clients (7 campos)
- A2: migration checklist tables + enums
- A3: migration notification events (3 novos)
- A4: regenerar tipos
- B1: deadlines.ts + chain.ts (helpers puros, TDD)
- B2: queries.ts (lista por mês, detalhe step) (TDD)
- B3: actions.ts (markPronto, updateField, setResponsavel) (TDD)
- B4: detector cron checklist-monthly (TDD)
- C1: sidebar update + page layout
- C2: PainelTable + StatusCell + StepModal
- C3: filtros (MesSelector + AssessorSelector reusing existing)
- C4: form clientes update (7 campos novos)
- D1: e2e + push + PR

Plano detalhado virá no documento de implementação.

## 7. Lacunas conhecidas (intencionais)

- Sem prazos por cliente — todos seguem D-X global. Pode customizar depois.
- Sem importação automática da planilha Excel — migração manual.
- Sem etapa "kickoff" / D0-D30 onboarding inicial — Fase 12 futura.
- Sem analytics de tempo médio por etapa.
- Sem reabertura de etapa pronta (uma vez pronta, fica pronta — só Sócio/ADM pode mudar via Supabase).
- Etapas paralelas não têm "próxima etapa" — apenas notificam.
- `valor_trafego` é input numérico no campo R$ do checklist; não é "etapa pronta/pendente" mas conta como preenchida quando > 0.
