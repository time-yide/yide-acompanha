# Fase 9.1 — Dashboards Coordenador + Assessor + Comercial — Design Spec

**Status:** Aprovado em 2026-04-28
**Spec mãe:** [2026-04-26-sistema-acompanhamento-design.md](./2026-04-26-sistema-acompanhamento-design.md) seção 5.9
**Spec da Fase 9:** [2026-04-28-fase-9-dashboard-design.md](./2026-04-28-fase-9-dashboard-design.md)
**Plano anterior:** Fase 9 — Dashboard Sócio/ADM (mergeado em main, commit `bcd6023`)

## 1. Objetivo

Adicionar dashboards específicos para **Coordenador**, **Assessor** e **Comercial** ao mesmo `(authed)/page.tsx` que hoje despacha Sócio/ADM. Reusa massivamente as queries e componentes da Fase 9, parametrizando-os com filtros opcionais. Adiciona queries novas exclusivas pro Comercial (leads, funil, reuniões) e um KPI/cálculo de "comissão prevista" ao vivo para todos os 3 papéis.

## 2. Escopo

### 2.1 Dentro do escopo

- Dashboard do Coordenador (mesmos blocos do Sócio/ADM, filtrados por equipe coordenada)
- Dashboard do Assessor (KPIs próprios + 2 gráficos + ranking dos próprios clientes + eventos próprios)
- Dashboard do Comercial (KPIs de leads + funil + meta tracker + próximas reuniões)
- KPI "minha comissão prevista" (cálculo ao vivo) em todos os 3 dashboards
- Componente novo `<MetaTracker>` (progresso de meta automática) só pro Comercial
- Componente novo `<ChartFunil>` (5 estágios) só pro Comercial
- Outros papéis (videomaker, designer, editor, audiovisual_chefe) continuam com `<StubGreeting>` (sem dashboard previsto na spec mãe)

### 2.2 Fora do escopo

- UI de configuração de meta personalizada → Fase 10 (junto da Prospecção)
- Drill-down em gráficos → futuro
- Comparação histórica entre comerciais → futuro
- Customização de blocos → futuro
- Migração de schema (queremos zero migrações) — meta é sempre automática

## 3. Arquitetura

### 3.1 Estrutura de arquivos

```
src/app/(authed)/page.tsx                                  [MODIFY — adicionar 3 branches]

src/lib/dashboard/
├── queries.ts                                             [MODIFY — parametrizar com filter]
├── comercial-queries.ts                                   [NEW — leads, funil, reuniões]
└── comissao-prevista.ts                                   [NEW — cálculo ao vivo]

src/components/dashboard/
├── KpiRowCoord.tsx                                        [NEW — server, 5 KPIs incluindo comissão]
├── KpiRowAssessor.tsx                                     [NEW — server, 4 KPIs incluindo comissão]
├── KpiRowComercial.tsx                                    [NEW — server, 5 KPIs incluindo comissão]
├── ChartFunil.tsx                                         [NEW — client]
├── MetaTracker.tsx                                        [NEW — server]
├── ProximasReunioesList.tsx                               [NEW — server, leads-based]
├── DashboardCoord.tsx                                     [NEW — composição completa]
├── DashboardAssessor.tsx                                  [NEW — composição completa]
└── DashboardComercial.tsx                                 [NEW — composição completa]

tests/unit/
├── dashboard-queries.test.ts                              [MODIFY — adicionar testes de filter]
├── dashboard-comissao.test.ts                             [NEW]
└── dashboard-comercial.test.ts                            [NEW]
```

### 3.2 Estratégia de queries — DRY com filter opcional

Vamos modificar as queries da Fase 9 pra aceitarem um filter opcional. Sem filter = comportamento atual (Sócio/ADM). Com filter = mesma lógica, com WHERE adicional.

```ts
// Em src/lib/dashboard/queries.ts

export interface ClientFilter {
  assessorId?: string;     // só clientes onde assessor_id = X
  coordenadorId?: string;  // só clientes onde coordenador_id = X
}

export interface EventoFilter {
  userId?: string;         // só eventos onde participantes_ids contém X
}

// Assinaturas atualizadas:
getKpis(now?: Date, filter?: ClientFilter): Promise<KpiData>
getCarteiraTimeline(months?: number, now?: Date, filter?: ClientFilter): Promise<TimelinePoint[]>
getEntradaChurn(months?: number, now?: Date, filter?: ClientFilter): Promise<EntradaChurnPoint[]>
getCarteiraPorAssessor(filter?: ClientFilter): Promise<AssessorCarteira[]>  // útil só pro Coord
getRankingSatisfacao(filter?: ClientFilter): Promise<{ top, bottom }>
getProximosEventos(days?: number, limit?: number, filter?: EventoFilter): Promise<EventoRow[]>
```

**Implementação do filter (genérica nas queries que leem `clients`):**
- `filter.assessorId` → adiciona `.eq("assessor_id", filter.assessorId)` no Supabase query OU filter em memória após fetch.
- `filter.coordenadorId` → idem com `coordenador_id`.

Pra `getRankingSatisfacao` (que filtra por cliente_id via join), o filter aplica-se à `cliente.assessor_id` ou `cliente.coordenador_id` no resultado.

Pra `getProximosEventos`, `filter.userId` → adiciona `.contains("participantes_ids", [userId])`.

A page do Sócio/ADM (Fase 9) continua chamando sem filter — comportamento idêntico ao atual.

### 3.3 Comissão prevista — cálculo ao vivo

`src/lib/dashboard/comissao-prevista.ts`:

```ts
export interface ComissaoPrevista {
  valor: number;        // total = base × percentual + fixo
  baseCalculo: number;  // sum dos valores que entraram na base
  fixo: number;
  percentual: number;
}

export async function getComissaoPrevista(userId: string, role: UserRole): Promise<ComissaoPrevista>
```

**Lógica por papel:**
- **Assessor:** base = soma de `valor_mensal` de clientes ativos onde `assessor_id = userId`. Para clientes onde `data_entrada` cai no mês corrente, usa `comissao_primeiro_mes_percent`; para os demais, `comissao_percent`. Total = base aplicado + `fixo_mensal`.
- **Coordenador:** base = soma de `valor_mensal` de clientes ativos onde `coordenador_id = userId`. Mesma regra de primeiro mês. + `fixo_mensal`.
- **Comercial:** base = soma de `valor_proposto` de leads onde `comercial_id = userId AND data_fechamento` está no mês corrente AND `stage = 'ativo'`. × `comissao_percent` (ou `comissao_primeiro_mes_percent` se aplicável). + `fixo_mensal`.

Retorna 0 se não houver dados.

### 3.4 Comercial — queries novas

`src/lib/dashboard/comercial-queries.ts`:

```ts
export interface LeadsKpis {
  leadsAtivos: number;      // count onde stage != 'ativo' AND motivo_perdido IS NULL
  fechamentosMes: number;   // count onde stage = 'ativo' AND data_fechamento no mês corrente
  ticketMedio: number;      // média de valor_proposto dos fechados nos últimos 90 dias
  taxaConversao: number;    // (fechados últimos 90d) / (total criados últimos 90d) × 100
}

export interface FunnelStage {
  stage: "prospeccao" | "comercial" | "contrato" | "marco_zero" | "ativo";
  label: string;            // "Prospecção", "Em comercial", "Contrato", "Marco zero", "Ativo"
  count: number;
  totalValor: number;       // soma de valor_proposto
}

export interface ProximaReuniao {
  leadId: string;
  nomeProspect: string;
  tipo: "prospeccao_agendada" | "marco_zero";
  data: string;             // ISO
}

export interface MetaComercial {
  metaFechamento: number;   // quanto precisa fechar
  metaComissao: number;     // 3× fixo (a comissão alvo)
  fechadoMes: number;       // quanto já fechou no mês corrente
  comissaoAtual: number;    // comissão prevista do que já fechou
  pctMeta: number;          // 0-100+ (pode passar de 100)
  status: "abaixo" | "no-caminho" | "perto" | "atingido"; // < 30 | < 80 | < 100 | >= 100
}

export async function getLeadsKpis(comercialId: string): Promise<LeadsKpis>
export async function getFunnelData(comercialId: string): Promise<FunnelStage[]>
export async function getProximasReunioes(comercialId: string, days?: number): Promise<ProximaReuniao[]>
export async function getMetaComercial(userId: string): Promise<MetaComercial>
```

**Notas:**
- `getLeadsKpis` filtra TODAS as queries por `comercial_id = comercialId`.
- `getFunnelData` retorna 1 entry por stage, mesmo que count=0 (5 entries sempre — pra gráfico não pular estágios vazios).
- `getProximasReunioes` faz UNION das duas datas: leads onde `data_prospeccao_agendada >= now AND <= now+days` e leads onde `data_reuniao_marco_zero >= now AND <= now+days`. Se um lead aparece em ambas, vira 2 entries (uma de cada tipo).
- `getMetaComercial` constante interna `METAS_MULTIPLIER = 3`. Meta = `(3 × fixo_mensal) / (comissao_percent / 100)`. Se `comissao_percent` = 0, retorna `metaFechamento = 0` (não divide por zero).

### 3.5 Componentes UI novos

**`<KpiRowCoord>`** (server)
- Props: `kpis` (KpiData), `comissao` (ComissaoPrevista)
- Renderiza 5 KpiCards: carteira sob coord, clientes ativos, churn mês, custo comissão %, **comissão prevista** (com helper "= sua estimativa do mês")

**`<KpiRowAssessor>`** (server)
- Props: `kpis` (KpiData), `comissao` (ComissaoPrevista)
- Renderiza 4 KpiCards: minha carteira, meus clientes, meu churn, **comissão prevista**

**`<KpiRowComercial>`** (server)
- Props: `leadsKpis` (LeadsKpis), `comissao` (ComissaoPrevista)
- Renderiza 5 KpiCards: leads ativos, fechamentos do mês, ticket médio (R$), conversão (%), **comissão prevista**

**`<ChartFunil>`** (`"use client"`)
- Props: `data` (FunnelStage[])
- Renderiza `<BarChart>` horizontal do recharts. Stages no eixo Y, count no eixo X.
- Cada barra com cor diferente (gradiente do mais claro pro mais saturado conforme avança no funil).
- Tooltip com count + valor total.

**`<MetaTracker>`** (server)
- Props: `meta` (MetaComercial)
- Card com:
  - Header: "Meta de [Mês]" + valor da meta + comissão alvo
  - Barra de progresso horizontal grande (h-6, rounded), com fill colorido por status
  - Texto: "Fechou R$ X · Y% da meta"
  - Texto secundário: se atingiu, "🎉 Meta atingida — [valor extra] em comissão extra"; senão "Falta R$ X → mais R$ Y de comissão se atingir"
- Cores por status:
  - `abaixo` (< 30%): cinza
  - `no-caminho` (30-79%): amber
  - `perto` (80-99%): primário (verde teal Yide)
  - `atingido` (≥ 100%): verde escuro

**`<ProximasReunioesList>`** (server)
- Props: `reunioes` (ProximaReuniao[])
- Lista similar a `ProximosEventosList`, mas com:
  - Ícone azul (`Briefcase`) pra `prospeccao_agendada`, ícone roxo (`Handshake`) pra `marco_zero`
  - Texto: tipo + nome do prospect + data formatada (Hoje/Amanhã/DD/MMM HH:MM)
- Caso vazio: "Sem reuniões nos próximos 14 dias"

### 3.6 Componentes de composição (1 por papel)

**`<DashboardCoord>`** (server, async)
- Props: `userId` (string)
- Roda em paralelo: `getKpis(now, { coordenadorId: userId })`, `getCarteiraTimeline(12, now, { coordenadorId: userId })`, `getEntradaChurn(6, now, { coordenadorId: userId })`, `getCarteiraPorAssessor({ coordenadorId: userId })`, `getRankingSatisfacao({ coordenadorId: userId })`, `getProximosEventos(30, 10, { userId })`, `getComissaoPrevista(userId, "coordenador")`
- Layout: header → KpiRowCoord → 2 charts grid → carteira por assessor → ranking + eventos grid

**`<DashboardAssessor>`** (server, async)
- Props: `userId` (string)
- Mesmas queries de Coord mas com `{ assessorId: userId }`. **Sem** `getCarteiraPorAssessor` (assessor não tem time).
- Layout: header → KpiRowAssessor → 2 charts grid → ranking + eventos grid

**`<DashboardComercial>`** (server, async)
- Props: `userId` (string)
- Roda em paralelo: `getLeadsKpis`, `getFunnelData`, `getProximasReunioes`, `getMetaComercial`, `getComissaoPrevista`
- Layout: header → KpiRowComercial → ChartFunil + MetaTracker grid → ProximasReunioesList

### 3.7 Page dispatcher

```tsx
// src/app/(authed)/page.tsx
export default async function DashboardPage() {
  const user = await requireAuth();

  if (user.role === "socio" || user.role === "adm") {
    return <DashboardSocioAdm />; // existente da Fase 9 (extraído do JSX atual)
  }
  if (user.role === "coordenador") {
    return <DashboardCoord userId={user.id} />;
  }
  if (user.role === "assessor") {
    return <DashboardAssessor userId={user.id} />;
  }
  if (user.role === "comercial") {
    return <DashboardComercial userId={user.id} />;
  }
  return <StubGreeting nome={user.nome} />;
}
```

**Ação importante:** o JSX atual da Fase 9 (Sócio/ADM) será extraído pro novo `<DashboardSocioAdm>` em `src/components/dashboard/DashboardSocioAdm.tsx`, mantendo comportamento idêntico. Isso DRY-ifica o page.tsx.

## 4. Considerações não-funcionais

### 4.1 Performance

- Cada dashboard roda 5-7 queries em paralelo via `Promise.all`. Tempo esperado: <500ms.
- Sem cache adicional (consistente com Fase 9).
- `getMetaComercial` reusa `getComissaoPrevista` internamente — uma chamada extra ao perfil é evitada via composição.

### 4.2 Tema dark/light

- Charts usam mesmo padrão da Fase 9 (recharts respeita CSS vars).
- MetaTracker usa classes Tailwind condicionais (já tipadas pelo Tailwind).

### 4.3 Mobile

- Mesmo padrão da Fase 9: grid 1col mobile → 2col tablet → N-col desktop.
- ChartFunil: horizontal funciona melhor em mobile que vertical.
- MetaTracker: barra fica 100% width em mobile (já é o default).

## 5. Tests

### 5.1 Unit

`tests/unit/dashboard-queries.test.ts` (MODIFY — adicionar):
- `getKpis` com `filter.assessorId` retorna só clientes do assessor
- `getKpis` com `filter.coordenadorId` retorna só clientes do coord
- `getCarteiraTimeline` com filter funciona corretamente
- `getProximosEventos` com `filter.userId` retorna só eventos do user

`tests/unit/dashboard-comissao.test.ts` (NEW):
- `getComissaoPrevista` para assessor: soma carteira × percentual + fixo
- `getComissaoPrevista` aplica `comissao_primeiro_mes_percent` em clientes do mês corrente
- `getComissaoPrevista` para comercial: soma valor_proposto de leads fechados no mês × percentual + fixo
- `getComissaoPrevista` retorna fixo apenas (sem base) quando user não tem nada

`tests/unit/dashboard-comercial.test.ts` (NEW):
- `getLeadsKpis` calcula leadsAtivos, fechamentosMes, ticketMedio, taxaConversao
- `getFunnelData` retorna sempre 5 entries (uma por stage), mesmo quando vazias
- `getProximasReunioes` une as 2 datas (prospeccao_agendada + reuniao_marco_zero) e ordena por data
- `getMetaComercial` calcula meta = (3 × fixo) / (percentual / 100) e pctMeta corretamente
- `getMetaComercial` retorna `metaFechamento = 0` quando comissao_percent = 0 (proteção div/zero)

Total: ~13 testes novos.

### 5.2 E2E

Auth-redirect pra `/` já existe da Fase 9. Não precisa nada novo.

## 6. Plano de execução resumido (~14 commits)

- **A1**: parametrizar queries Fase 9 com filter (1 commit)
- **A2**: extrair JSX Sócio/ADM pro `<DashboardSocioAdm>` (1 commit, sem mudança comportamental)
- **B1**: getComissaoPrevista (TDD, 1 commit)
- **B2**: comercial-queries (leadsKpis + funnel + reunioes + meta) (TDD, 1 commit)
- **C1**: KpiRowCoord (1 commit)
- **C2**: KpiRowAssessor (1 commit)
- **C3**: KpiRowComercial (1 commit)
- **C4**: ChartFunil (1 commit)
- **C5**: MetaTracker (1 commit)
- **C6**: ProximasReunioesList (1 commit)
- **D1**: DashboardCoord (1 commit)
- **D2**: DashboardAssessor (1 commit)
- **D3**: DashboardComercial (1 commit)
- **D4**: page.tsx dispatcher + push + PR (1 commit)

Plano detalhado virá no documento de implementação.

## 7. Lacunas conhecidas (intencionais)

- Sem UI de configuração de meta — meta é sempre `3 × fixo / percentual`. Phase 10 (Prospecção) planejada pra adicionar customização.
- Sem comparação com mês anterior nos KPIs do Comercial — fica simples.
- Sem alerta de mês de comissão pendente para Coord/Assessor (só Sócio/ADM têm essa permissão de aprovar).
