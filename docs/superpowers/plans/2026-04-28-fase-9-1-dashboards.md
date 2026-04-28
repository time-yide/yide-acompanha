# Fase 9.1 — Dashboards Coord + Assessor + Comercial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar dashboards Coordenador, Assessor e Comercial ao mesmo `(authed)/page.tsx` que hoje tem só Sócio/ADM. Reusa queries da Fase 9 com filter opcional. Adiciona queries novas pra Comercial (leads/funil/reuniões/meta) e KPI "comissão prevista" ao vivo.

**Architecture:** Parametrizar queries existentes com `ClientFilter` opcional (DRY). Extrair JSX da Sócio/ADM da Fase 9 pro novo `<DashboardSocioAdm>`. Criar 3 novos dashboards-componentes que compõem queries + UI. Page raiz vira um dispatcher por `user.role`.

**Tech Stack:** Next.js 16 + Supabase + recharts (já instalado) + Base UI + Tailwind + Vitest.

**Spec:** [docs/superpowers/specs/2026-04-28-fase-9-1-dashboards-design.md](../specs/2026-04-28-fase-9-1-dashboards-design.md)

**Plano anterior:** [Fase 9 — Dashboard Sócio/ADM](2026-04-28-fase-9-dashboard.md)

**Branch:** `claude/fase-9-1-dashboards` (já criada do `main` no commit `bcd6023`)

**Fora do escopo:**
- UI de configuração de meta personalizada → Fase 10 (Prospecção)
- Drill-down em gráficos → futuro
- Comparação entre comerciais → futuro
- Migrações de schema (queremos zero migrações)

**Pré-requisitos:**
- Branch `claude/fase-9-1-dashboards` checked out (já feito)
- Tabelas e enums já existentes — sem migrações
- recharts já instalado da Fase 9

**Estado atual no repositório:**
- `src/lib/dashboard/queries.ts` (Fase 9) com 7 queries SEM filter
- `src/app/(authed)/page.tsx` com role check (Sócio/ADM dispatcha pro JSX inline; outros mostram `<StubGreeting>`)
- Componentes da Fase 9 em `src/components/dashboard/` — todos vão ser reusados

**Estrutura final esperada:**

```
src/
├── app/(authed)/page.tsx                                   [MODIFY — 4 branches]
├── lib/dashboard/
│   ├── queries.ts                                          [MODIFY — adicionar filter]
│   ├── comissao-prevista.ts                                [NEW]
│   └── comercial-queries.ts                                [NEW]
└── components/dashboard/
    ├── DashboardSocioAdm.tsx                               [NEW — extraído do page.tsx atual]
    ├── DashboardCoord.tsx                                  [NEW]
    ├── DashboardAssessor.tsx                               [NEW]
    ├── DashboardComercial.tsx                              [NEW]
    ├── KpiRowCoord.tsx                                     [NEW]
    ├── KpiRowAssessor.tsx                                  [NEW]
    ├── KpiRowComercial.tsx                                 [NEW]
    ├── ChartFunil.tsx                                      [NEW — client]
    ├── MetaTracker.tsx                                     [NEW]
    └── ProximasReunioesList.tsx                            [NEW]

tests/unit/
├── dashboard-queries.test.ts                               [MODIFY — adicionar testes de filter]
├── dashboard-comissao.test.ts                              [NEW]
└── dashboard-comercial.test.ts                             [NEW]
```

**Total estimado:** ~14 commits.

---

## Bloco A — Refactor: parametrizar queries da Fase 9 + extrair Sócio/ADM

### Task A1: Parametrizar `getKpis`, `getCarteiraTimeline`, `getEntradaChurn` com filter (TDD)

**Files:**
- Modify: `src/lib/dashboard/queries.ts`
- Modify: `tests/unit/dashboard-queries.test.ts`

- [ ] **Step A1.1: Adicionar testes de filter**

APPEND ao final de `tests/unit/dashboard-queries.test.ts`:

```ts
describe("getKpis with filter", () => {
  it("filtra clientes por assessorId quando passado", async () => {
    const eqMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [
          { id: "c1", valor_mensal: 5000, data_entrada: "2025-01-01", data_churn: null, status: "ativo", assessor_id: "a1" },
        ],
      }),
    });
    fromMock.mockImplementation((table) => {
      if (table === "clients") {
        return { select: () => ({ eq: eqMock }) };
      }
      if (table === "commission_snapshots") {
        return { select: () => ({ order: () => ({ limit: vi.fn().mockResolvedValue({ data: [] }) }) }) };
      }
      return {};
    });

    const r = await getKpis(new Date(Date.UTC(2026, 3, 28)), { assessorId: "a1" });
    expect(r.carteiraAtiva.valor).toBe(5000);
    expect(r.clientesAtivos.quantidade).toBe(1);
  });

  it("filtra clientes por coordenadorId quando passado", async () => {
    const eqMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [
          { id: "c1", valor_mensal: 3000, data_entrada: "2025-01-01", data_churn: null, status: "ativo", coordenador_id: "co1" },
          { id: "c2", valor_mensal: 4000, data_entrada: "2025-01-01", data_churn: null, status: "ativo", coordenador_id: "co1" },
        ],
      }),
    });
    fromMock.mockImplementation((table) => {
      if (table === "clients") {
        return { select: () => ({ eq: eqMock }) };
      }
      if (table === "commission_snapshots") {
        return { select: () => ({ order: () => ({ limit: vi.fn().mockResolvedValue({ data: [] }) }) }) };
      }
      return {};
    });

    const r = await getKpis(new Date(Date.UTC(2026, 3, 28)), { coordenadorId: "co1" });
    expect(r.carteiraAtiva.valor).toBe(7000);
    expect(r.clientesAtivos.quantidade).toBe(2);
  });
});

describe("getCarteiraTimeline with filter", () => {
  it("filtra clientes por assessorId quando passado", async () => {
    const eqMock = vi.fn().mockResolvedValue({
      data: [
        { id: "c1", valor_mensal: 5000, data_entrada: "2026-01-15", data_churn: null, assessor_id: "a1" },
      ],
    });
    fromMock.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({ eq: eqMock }),
    }));

    const timeline = await getCarteiraTimeline(2, new Date(Date.UTC(2026, 3, 28)), { assessorId: "a1" });
    expect(timeline).toHaveLength(2);
    expect(timeline[1].valorTotal).toBe(5000);
  });
});

describe("getEntradaChurn with filter", () => {
  it("filtra entradas e churns por coordenadorId quando passado", async () => {
    const eqMock = vi.fn().mockResolvedValue({
      data: [
        { id: "c1", data_entrada: "2026-04-01", data_churn: null, coordenador_id: "co1" },
      ],
    });
    fromMock.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({ eq: eqMock }),
    }));

    const data = await getEntradaChurn(2, new Date(Date.UTC(2026, 3, 28)), { coordenadorId: "co1" });
    expect(data[1].entradas).toBe(1);
  });
});
```

- [ ] **Step A1.2: Rodar tests, esperar falhar**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
npm run test -- tests/unit/dashboard-queries.test.ts
```

Esperar: tests falham (queries não aceitam o argumento `filter`).

- [ ] **Step A1.3: Modificar `src/lib/dashboard/queries.ts`**

Adicione a interface `ClientFilter` logo após a interface `KpiData`:

```ts
export interface ClientFilter {
  assessorId?: string;
  coordenadorId?: string;
}

function buildClientFilterQuery<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  filter?: ClientFilter,
): T {
  let q = query;
  if (filter?.assessorId) q = q.eq("assessor_id", filter.assessorId);
  if (filter?.coordenadorId) q = q.eq("coordenador_id", filter.coordenadorId);
  return q;
}
```

Substitua a função `getKpis` inteira pela versão filtrada:

```ts
export async function getKpis(now: Date = new Date(), filter?: ClientFilter): Promise<KpiData> {
  const supabase = await createClient();
  const monthRef = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const todayIso = now.toISOString().slice(0, 10);

  const prevMonthLastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))
    .toISOString()
    .slice(0, 10);

  let clientsQuery = supabase
    .from("clients")
    .select("id, valor_mensal, data_entrada, data_churn, status, assessor_id, coordenador_id")
    .eq("status", "ativo");
  clientsQuery = buildClientFilterQuery(clientsQuery, filter);

  const { data: clientsData } = await clientsQuery;
  const allClients = (clientsData ?? []) as ClientRow[];

  const ativosHoje = allClients.filter((c) => isActiveOn(c, todayIso));
  const ativosFimMesAnterior = allClients.filter((c) => isActiveOn(c, prevMonthLastDay));

  const carteiraAtivaValor = ativosHoje.reduce((acc, c) => acc + Number(c.valor_mensal), 0);
  const carteiraMesAnteriorValor = ativosFimMesAnterior.reduce((acc, c) => acc + Number(c.valor_mensal), 0);

  const churnsDoMes = allClients.filter((c) => isInMonth(c.data_churn, monthRef));
  const valorChurnado = churnsDoMes.reduce((acc, c) => acc + Number(c.valor_mensal), 0);

  const { data: snapshotsData } = await supabase
    .from("commission_snapshots")
    .select("mes_referencia, valor_total")
    .order("mes_referencia", { ascending: false })
    .limit(50);
  const snapshots = (snapshotsData ?? []) as Array<{ mes_referencia: string; valor_total: number }>;
  const ultimoMes = snapshots[0]?.mes_referencia;
  const totalComissao = ultimoMes
    ? snapshots.filter((s) => s.mes_referencia === ultimoMes).reduce((a, s) => a + Number(s.valor_total), 0)
    : 0;
  const pctComissao = carteiraAtivaValor > 0 ? (totalComissao / carteiraAtivaValor) * 100 : 0;

  return {
    carteiraAtiva: { valor: carteiraAtivaValor, deltaValor: carteiraAtivaValor - carteiraMesAnteriorValor },
    clientesAtivos: { quantidade: ativosHoje.length, deltaQuantidade: ativosHoje.length - ativosFimMesAnterior.length },
    churnMes: { quantidade: churnsDoMes.length, valorPerdido: valorChurnado },
    custoComissaoPct: { pct: pctComissao },
  };
}
```

Atualize a `interface ClientRow` (no topo do arquivo) pra incluir os campos novos:

```ts
interface ClientRow {
  id: string;
  valor_mensal: number;
  data_entrada: string;
  data_churn: string | null;
  status: string;
  assessor_id?: string | null;
  coordenador_id?: string | null;
}
```

Substitua `getCarteiraTimeline`:

```ts
export async function getCarteiraTimeline(
  months: number = 12,
  now: Date = new Date(),
  filter?: ClientFilter,
): Promise<TimelinePoint[]> {
  const supabase = await createClient();
  const meses = monthRange(months, now);

  let clientsQuery = supabase
    .from("clients")
    .select("id, valor_mensal, data_entrada, data_churn, assessor_id, coordenador_id");
  clientsQuery = buildClientFilterQuery(clientsQuery as never, filter) as never;

  const { data: clientsData } = await clientsQuery;
  const clients = (clientsData ?? []) as Array<{
    id: string;
    valor_mensal: number;
    data_entrada: string;
    data_churn: string | null;
    assessor_id?: string | null;
    coordenador_id?: string | null;
  }>;

  return meses.map((mes) => {
    const fimDoMes = lastDayOfMonth(mes);
    const ativos = clients.filter((c) => {
      if (c.data_entrada > fimDoMes) return false;
      if (c.data_churn && c.data_churn <= fimDoMes) return false;
      return true;
    });
    const valorTotal = ativos.reduce((acc, c) => acc + Number(c.valor_mensal), 0);
    return { mes, valorTotal };
  });
}
```

Substitua `getEntradaChurn`:

```ts
export async function getEntradaChurn(
  months: number = 6,
  now: Date = new Date(),
  filter?: ClientFilter,
): Promise<EntradaChurnPoint[]> {
  const supabase = await createClient();
  const meses = monthRange(months, now);

  let clientsQuery = supabase
    .from("clients")
    .select("id, data_entrada, data_churn, assessor_id, coordenador_id");
  clientsQuery = buildClientFilterQuery(clientsQuery as never, filter) as never;

  const { data: clientsData } = await clientsQuery;
  const clients = (clientsData ?? []) as Array<{
    id: string;
    data_entrada: string;
    data_churn: string | null;
    assessor_id?: string | null;
    coordenador_id?: string | null;
  }>;

  return meses.map((mes) => {
    const entradas = clients.filter((c) => isInMonth(c.data_entrada, mes)).length;
    const churns = clients.filter((c) => isInMonth(c.data_churn, mes)).length;
    return { mes, entradas, churns };
  });
}
```

- [ ] **Step A1.4: Rodar tests, esperar passar**

```bash
npm run test -- tests/unit/dashboard-queries.test.ts
npm run typecheck
```

Esperar: 25/25 pass (16 prior + 4 new from filter tests + 5 ranking que existiam).

Wait — vamos verificar a contagem real. A Fase 9 deixou 21 testes. Nesta task adicionamos 4 testes novos. Esperar 25/25. Se o número final divergir, é porque os testes anteriores cobriam cenários diferentes — investigar.

- [ ] **Step A1.5: Commit**

```bash
git add src/lib/dashboard/queries.ts tests/unit/dashboard-queries.test.ts
git commit -m "feat(dashboard): parametrizar getKpis, getCarteiraTimeline, getEntradaChurn com filter (TDD)"
```

---

### Task A2: Parametrizar `getCarteiraPorAssessor`, `getRankingSatisfacao`, `getProximosEventos` com filter (TDD)

**Files:**
- Modify: `src/lib/dashboard/queries.ts`
- Modify: `tests/unit/dashboard-queries.test.ts`

- [ ] **Step A2.1: Adicionar testes**

APPEND ao final de `tests/unit/dashboard-queries.test.ts`:

```ts
describe("getCarteiraPorAssessor with filter", () => {
  it("filtra clientes por coordenadorId quando passado (mostra só os assessores que ele coordena)", async () => {
    const eqMock = vi.fn().mockResolvedValue({
      data: [
        { id: "c1", valor_mensal: 5000, assessor_id: "a1", assessor: { nome: "Ana" }, coordenador_id: "co1" },
        { id: "c2", valor_mensal: 3000, assessor_id: "a2", assessor: { nome: "Bruno" }, coordenador_id: "co1" },
      ],
    });
    fromMock.mockImplementation(() => ({
      select: () => ({ eq: vi.fn().mockReturnValue({ eq: eqMock }) }),
    }));

    const list = await getCarteiraPorAssessor({ coordenadorId: "co1" });
    expect(list).toHaveLength(2);
    expect(list[0].valorTotal).toBe(5000);
    expect(list[1].valorTotal).toBe(3000);
  });
});

describe("getRankingSatisfacao with filter", () => {
  it("filtra sínteses por assessorId quando passado", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "satisfaction_synthesis") {
        return {
          select: (cols: string) => {
            if (cols === "semana_iso") {
              return {
                order: () => ({
                  limit: vi.fn().mockResolvedValue({ data: [{ semana_iso: "2026-W17" }] }),
                }),
              };
            }
            return {
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: "s1", client_id: "c1", semana_iso: "2026-W17", score_final: 9.5, cor_final: "verde", resumo_ia: "ok", divergencia_detectada: false, acao_sugerida: null, created_at: "2026-04-27", cliente: { nome: "Alpha", assessor_id: "a1", coordenador_id: "co1" } },
                  { id: "s2", client_id: "c2", semana_iso: "2026-W17", score_final: 8.0, cor_final: "verde", resumo_ia: "ok", divergencia_detectada: false, acao_sugerida: null, created_at: "2026-04-27", cliente: { nome: "Beta", assessor_id: "a2", coordenador_id: "co1" } },
                ],
              }),
            };
          },
        };
      }
      return {};
    });

    const r = await getRankingSatisfacao({ assessorId: "a1" });
    expect(r.top).toHaveLength(1);
    expect(r.top[0].client_id).toBe("c1");
  });
});

describe("getProximosEventos with filter", () => {
  it("filtra eventos por participantes_ids contendo userId quando passado", async () => {
    const containsMock = vi.fn().mockReturnValue({
      gte: () => ({
        lte: () => ({
          order: () => ({
            limit: vi.fn().mockResolvedValue({
              data: [{ id: "e1", titulo: "Reunião X", inicio: "2026-04-29T10:00:00Z", fim: "2026-04-29T11:00:00Z", sub_calendar: "agencia" }],
            }),
          }),
        }),
      }),
    });
    fromMock.mockImplementation((table) => {
      if (table === "calendar_events") {
        return { select: () => ({ contains: containsMock }) };
      }
      return {};
    });

    const eventos = await getProximosEventos(30, 10, { userId: "u1" });
    expect(eventos).toHaveLength(1);
    expect(containsMock).toHaveBeenCalledWith("participantes_ids", ["u1"]);
  });
});
```

- [ ] **Step A2.2: Rodar tests, esperar falhar**

```bash
npm run test -- tests/unit/dashboard-queries.test.ts
```

- [ ] **Step A2.3: Modificar `queries.ts`**

Substitua `getCarteiraPorAssessor`:

```ts
export async function getCarteiraPorAssessor(filter?: ClientFilter): Promise<AssessorCarteira[]> {
  const supabase = await createClient();

  let clientsQuery = supabase
    .from("clients")
    .select("id, valor_mensal, assessor_id, coordenador_id, assessor:profiles!clients_assessor_id_fkey(nome)")
    .eq("status", "ativo");
  clientsQuery = buildClientFilterQuery(clientsQuery as never, filter) as never;

  const { data: clientsData } = await clientsQuery;

  const clients = (clientsData ?? []) as unknown as Array<{
    id: string;
    valor_mensal: number;
    assessor_id: string | null;
    coordenador_id: string | null;
    assessor: { nome: string } | null;
  }>;

  const groups = new Map<string, { nome: string; qtd: number; valor: number }>();
  for (const c of clients) {
    if (!c.assessor_id || !c.assessor) continue;
    const cur = groups.get(c.assessor_id) ?? { nome: c.assessor.nome, qtd: 0, valor: 0 };
    cur.qtd += 1;
    cur.valor += Number(c.valor_mensal);
    groups.set(c.assessor_id, cur);
  }

  const total = [...groups.values()].reduce((a, g) => a + g.valor, 0);

  const list: AssessorCarteira[] = [...groups.entries()].map(([id, g]) => ({
    assessorId: id,
    assessorNome: g.nome,
    qtdClientes: g.qtd,
    valorTotal: g.valor,
    pctDoTotal: total > 0 ? (g.valor / total) * 100 : 0,
  }));

  list.sort((a, b) => b.valorTotal - a.valorTotal);
  return list;
}
```

Substitua `getRankingSatisfacao`:

```ts
export async function getRankingSatisfacao(filter?: ClientFilter): Promise<{
  top: SynthesisRowWithCliente[];
  bottom: SynthesisRowWithCliente[];
}> {
  const supabase = await createClient();

  const { data: latestData } = await supabase
    .from("satisfaction_synthesis")
    .select("semana_iso")
    .order("semana_iso", { ascending: false })
    .limit(1);
  const latestWeek = (latestData?.[0] as { semana_iso?: string } | undefined)?.semana_iso;
  if (!latestWeek) return { top: [], bottom: [] };

  const { data: synthData } = await supabase
    .from("satisfaction_synthesis")
    .select("*, cliente:clients(nome, assessor_id, coordenador_id)")
    .eq("semana_iso", latestWeek);

  let all = (synthData ?? []) as unknown as SynthesisRowWithCliente[];

  // Filtra em memória (Supabase não filtra por campo nested via join facilmente)
  if (filter?.assessorId) {
    all = all.filter((s) => s.cliente?.assessor_id === filter.assessorId);
  }
  if (filter?.coordenadorId) {
    all = all.filter((s) => s.cliente?.coordenador_id === filter.coordenadorId);
  }

  const top = all
    .filter((s) => s.cor_final === "verde")
    .sort((a, b) => Number(b.score_final) - Number(a.score_final))
    .slice(0, 3);

  const bottom = all
    .filter((s) => s.cor_final === "vermelho" || s.cor_final === "amarelo")
    .sort((a, b) => {
      if (a.cor_final === "vermelho" && b.cor_final !== "vermelho") return -1;
      if (a.cor_final !== "vermelho" && b.cor_final === "vermelho") return 1;
      return Number(a.score_final) - Number(b.score_final);
    })
    .slice(0, 2);

  return { top, bottom };
}
```

Adicione `EventoFilter` e atualize `getProximosEventos`:

```ts
export interface EventoFilter {
  userId?: string;
}

export async function getProximosEventos(
  days: number = 30,
  limit: number = 10,
  filter?: EventoFilter,
): Promise<EventoRow[]> {
  const supabase = await createClient();
  const now = new Date();
  const start = now.toISOString();
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from("calendar_events")
    .select("id, titulo, inicio, fim, sub_calendar");

  if (filter?.userId) {
    query = query.contains("participantes_ids", [filter.userId]);
  }

  const { data } = await query
    .gte("inicio", start)
    .lte("inicio", end)
    .order("inicio", { ascending: true })
    .limit(limit);

  return (data ?? []) as EventoRow[];
}
```

- [ ] **Step A2.4: Rodar tests, esperar passar**

```bash
npm run test -- tests/unit/dashboard-queries.test.ts
npm run typecheck
```

Esperar: 28/28 pass.

- [ ] **Step A2.5: Commit**

```bash
git add src/lib/dashboard/queries.ts tests/unit/dashboard-queries.test.ts
git commit -m "feat(dashboard): parametrizar getCarteiraPorAssessor, getRankingSatisfacao, getProximosEventos com filter (TDD)"
```

---

### Task A3: Extrair JSX da Sócio/ADM pro `<DashboardSocioAdm>`

**Files:**
- Create: `src/components/dashboard/DashboardSocioAdm.tsx`
- Modify: `src/app/(authed)/page.tsx`

- [ ] **Step A3.1: Criar `DashboardSocioAdm.tsx`**

`src/components/dashboard/DashboardSocioAdm.tsx`:

```tsx
import {
  getKpis,
  getCarteiraTimeline,
  getEntradaChurn,
  getCarteiraPorAssessor,
  getRankingSatisfacao,
  getProximosEventos,
  getMesAguardandoAprovacao,
} from "@/lib/dashboard/queries";
import { KpiRow } from "./KpiRow";
import { ChartCarteiraTimeline } from "./ChartCarteiraTimeline";
import { ChartEntradaChurn } from "./ChartEntradaChurn";
import { CarteiraPorAssessorList } from "./CarteiraPorAssessorList";
import { RankingResumo } from "./RankingResumo";
import { ProximosEventosList } from "./ProximosEventosList";
import { AlertaAprovacao } from "./AlertaAprovacao";
import { Section } from "./Section";

interface Props {
  nome: string;
}

export async function DashboardSocioAdm({ nome }: Props) {
  const [
    kpis,
    carteiraTimeline,
    entradaChurn,
    carteiraPorAssessor,
    ranking,
    eventos,
    aprovacao,
  ] = await Promise.all([
    getKpis(),
    getCarteiraTimeline(12),
    getEntradaChurn(6),
    getCarteiraPorAssessor(),
    getRankingSatisfacao(),
    getProximosEventos(30, 10),
    getMesAguardandoAprovacao(),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Olá, {nome.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">Visão geral da agência</p>
      </header>

      <AlertaAprovacao mes={aprovacao?.mes ?? null} />

      <KpiRow kpis={kpis} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Evolução da carteira" subtitle="Últimos 12 meses">
          <ChartCarteiraTimeline data={carteiraTimeline} />
        </Section>
        <Section title="Entrada vs Churn" subtitle="Últimos 6 meses">
          <ChartEntradaChurn data={entradaChurn} />
        </Section>
      </div>

      <Section title="Carteira por assessor">
        <CarteiraPorAssessorList items={carteiraPorAssessor} />
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Satisfação" cta={{ href: "/satisfacao", label: "Ver completo →" }}>
          <RankingResumo top={ranking.top} bottom={ranking.bottom} />
        </Section>
        <Section title="Próximos eventos" cta={{ href: "/calendario", label: "Ver agenda →" }}>
          <ProximosEventosList eventos={eventos} />
        </Section>
      </div>
    </div>
  );
}
```

- [ ] **Step A3.2: Substituir `src/app/(authed)/page.tsx`**

```tsx
import { requireAuth } from "@/lib/auth/session";
import { DashboardSocioAdm } from "@/components/dashboard/DashboardSocioAdm";
import { StubGreeting } from "@/components/dashboard/StubGreeting";

export default async function DashboardPage() {
  const user = await requireAuth();

  if (user.role === "socio" || user.role === "adm") {
    return <DashboardSocioAdm nome={user.nome} />;
  }

  return <StubGreeting nome={user.nome} />;
}
```

- [ ] **Step A3.3: Typecheck**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
npm run typecheck
```

Esperar: clean.

- [ ] **Step A3.4: Commit**

```bash
git add src/components/dashboard/DashboardSocioAdm.tsx "src/app/(authed)/page.tsx"
git commit -m "refactor(dashboard): extract Sócio/ADM JSX to DashboardSocioAdm component"
```

---

## Bloco B — Backend novo

### Task B1: `getComissaoPrevista` (TDD)

**Files:**
- Create: `src/lib/dashboard/comissao-prevista.ts`
- Create: `tests/unit/dashboard-comissao.test.ts`

- [ ] **Step B1.1: Escrever testes**

Crie `tests/unit/dashboard-comissao.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromMock }),
}));

import { getComissaoPrevista } from "@/lib/dashboard/comissao-prevista";

beforeEach(() => {
  fromMock.mockReset();
});

describe("getComissaoPrevista", () => {
  it("calcula para assessor: soma carteira × percentual + fixo", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { fixo_mensal: 3000, comissao_percent: 10, comissao_primeiro_mes_percent: 5 },
              }),
            }),
          }),
        };
      }
      if (table === "clients") {
        return {
          select: () => ({
            eq: () => ({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: "c1", valor_mensal: 5000, data_entrada: "2025-01-01" },
                  { id: "c2", valor_mensal: 4000, data_entrada: "2025-06-01" },
                ],
              }),
            }),
          }),
        };
      }
      return {};
    });

    const r = await getComissaoPrevista("u1", "assessor", new Date(Date.UTC(2026, 3, 28)));
    // Base: (5000 + 4000) × 10% = 900; + fixo 3000 = 3900
    expect(r.baseCalculo).toBe(9000);
    expect(r.fixo).toBe(3000);
    expect(r.percentual).toBe(10);
    expect(r.valor).toBe(3900);
  });

  it("aplica comissao_primeiro_mes_percent em clientes que entraram no mês corrente", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { fixo_mensal: 1000, comissao_percent: 10, comissao_primeiro_mes_percent: 20 },
              }),
            }),
          }),
        };
      }
      if (table === "clients") {
        return {
          select: () => ({
            eq: () => ({
              eq: vi.fn().mockResolvedValue({
                data: [
                  // Cliente novo (entrou em abril 2026): usa primeiro_mes_percent (20%)
                  { id: "c1", valor_mensal: 5000, data_entrada: "2026-04-15" },
                  // Cliente antigo: usa percentual normal (10%)
                  { id: "c2", valor_mensal: 4000, data_entrada: "2025-01-01" },
                ],
              }),
            }),
          }),
        };
      }
      return {};
    });

    const r = await getComissaoPrevista("u1", "assessor", new Date(Date.UTC(2026, 3, 28)));
    // c1 (primeiro mês): 5000 × 20% = 1000
    // c2 (normal): 4000 × 10% = 400
    // total comissão variável: 1400; + fixo 1000 = 2400
    expect(r.valor).toBe(2400);
    expect(r.baseCalculo).toBe(9000);
  });

  it("calcula para coordenador filtrando por coordenador_id", async () => {
    const eqClientesByCoord = vi.fn().mockResolvedValue({
      data: [{ id: "c1", valor_mensal: 5000, data_entrada: "2025-01-01" }],
    });
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { fixo_mensal: 5000, comissao_percent: 5, comissao_primeiro_mes_percent: 5 },
              }),
            }),
          }),
        };
      }
      if (table === "clients") {
        return {
          select: () => ({ eq: () => ({ eq: eqClientesByCoord }) }),
        };
      }
      return {};
    });

    const r = await getComissaoPrevista("co1", "coordenador", new Date(Date.UTC(2026, 3, 28)));
    expect(r.valor).toBe(5250); // 5000 × 5% + 5000 fixo
  });

  it("calcula para comercial: soma valor_proposto de leads fechados no mês × percentual + fixo", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { fixo_mensal: 2000, comissao_percent: 10, comissao_primeiro_mes_percent: 10 },
              }),
            }),
          }),
        };
      }
      if (table === "leads") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gte: () => ({
                  lte: vi.fn().mockResolvedValue({
                    data: [
                      { id: "l1", valor_proposto: 50000, data_fechamento: "2026-04-10" },
                      { id: "l2", valor_proposto: 30000, data_fechamento: "2026-04-20" },
                    ],
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const r = await getComissaoPrevista("u1", "comercial", new Date(Date.UTC(2026, 3, 28)));
    // (50000 + 30000) × 10% = 8000; + fixo 2000 = 10000
    expect(r.valor).toBe(10000);
    expect(r.baseCalculo).toBe(80000);
  });

  it("retorna fixo apenas quando user não tem nada (sem clientes/leads)", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { fixo_mensal: 2500, comissao_percent: 10, comissao_primeiro_mes_percent: 10 },
              }),
            }),
          }),
        };
      }
      if (table === "clients") {
        return {
          select: () => ({ eq: () => ({ eq: vi.fn().mockResolvedValue({ data: [] }) }) }),
        };
      }
      if (table === "leads") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ gte: () => ({ lte: vi.fn().mockResolvedValue({ data: [] }) }) }),
            }),
          }),
        };
      }
      return {};
    });

    const rA = await getComissaoPrevista("u1", "assessor", new Date(Date.UTC(2026, 3, 28)));
    expect(rA.valor).toBe(2500);
    expect(rA.baseCalculo).toBe(0);
  });
});
```

- [ ] **Step B1.2: Rodar tests, esperar falhar**

```bash
npm run test -- tests/unit/dashboard-comissao.test.ts
```

- [ ] **Step B1.3: Criar `src/lib/dashboard/comissao-prevista.ts`**

```ts
// SERVER ONLY: do not import from client components
import { createClient } from "@/lib/supabase/server";
import { isInMonth } from "./date-utils";

export interface ComissaoPrevista {
  valor: number;
  baseCalculo: number;
  fixo: number;
  percentual: number;
}

type Role = "assessor" | "coordenador" | "comercial";

interface ProfileRow {
  fixo_mensal: number;
  comissao_percent: number;
  comissao_primeiro_mes_percent: number;
}

export async function getComissaoPrevista(
  userId: string,
  role: Role,
  now: Date = new Date(),
): Promise<ComissaoPrevista> {
  const supabase = await createClient();
  const monthRef = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  const { data: profileData } = await supabase
    .from("profiles")
    .select("fixo_mensal, comissao_percent, comissao_primeiro_mes_percent")
    .eq("id", userId)
    .single();
  const profile = (profileData as ProfileRow | null) ?? {
    fixo_mensal: 0,
    comissao_percent: 0,
    comissao_primeiro_mes_percent: 0,
  };

  let valorComissao = 0;
  let baseCalculo = 0;

  if (role === "assessor" || role === "coordenador") {
    const filterColumn = role === "assessor" ? "assessor_id" : "coordenador_id";
    const { data: clientsData } = await supabase
      .from("clients")
      .select("id, valor_mensal, data_entrada")
      .eq("status", "ativo")
      .eq(filterColumn, userId);

    const clients = (clientsData ?? []) as Array<{ id: string; valor_mensal: number; data_entrada: string }>;

    for (const c of clients) {
      const isPrimeiroMes = isInMonth(c.data_entrada, monthRef);
      const pct = isPrimeiroMes ? profile.comissao_primeiro_mes_percent : profile.comissao_percent;
      const valor = Number(c.valor_mensal);
      baseCalculo += valor;
      valorComissao += valor * (pct / 100);
    }
  } else if (role === "comercial") {
    const inicioMes = `${monthRef}-01`;
    const fimMes = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
      .toISOString()
      .slice(0, 10);

    const { data: leadsData } = await supabase
      .from("leads")
      .select("id, valor_proposto, data_fechamento")
      .eq("comercial_id", userId)
      .eq("stage", "ativo")
      .gte("data_fechamento", inicioMes)
      .lte("data_fechamento", fimMes);

    const leads = (leadsData ?? []) as Array<{ id: string; valor_proposto: number; data_fechamento: string }>;

    for (const l of leads) {
      const valor = Number(l.valor_proposto);
      baseCalculo += valor;
      valorComissao += valor * (profile.comissao_percent / 100);
    }
  }

  return {
    valor: valorComissao + Number(profile.fixo_mensal),
    baseCalculo,
    fixo: Number(profile.fixo_mensal),
    percentual: Number(profile.comissao_percent),
  };
}
```

- [ ] **Step B1.4: Rodar tests, esperar passar**

```bash
npm run test -- tests/unit/dashboard-comissao.test.ts
npm run typecheck
```

Esperar: 5/5 pass, typecheck clean.

- [ ] **Step B1.5: Commit**

```bash
git add src/lib/dashboard/comissao-prevista.ts tests/unit/dashboard-comissao.test.ts
git commit -m "feat(dashboard): getComissaoPrevista with live calculation per role (TDD)"
```

---

### Task B2: Comercial queries (`getLeadsKpis`, `getFunnelData`, `getProximasReunioes`, `getMetaComercial`) (TDD)

**Files:**
- Create: `src/lib/dashboard/comercial-queries.ts`
- Create: `tests/unit/dashboard-comercial.test.ts`

- [ ] **Step B2.1: Escrever testes**

Crie `tests/unit/dashboard-comercial.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromMock }),
}));

import {
  getLeadsKpis,
  getFunnelData,
  getProximasReunioes,
  getMetaComercial,
} from "@/lib/dashboard/comercial-queries";

beforeEach(() => {
  fromMock.mockReset();
});

describe("getLeadsKpis", () => {
  it("calcula leadsAtivos, fechamentosMes, ticketMedio, taxaConversao", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "leads") {
        return {
          select: () => ({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: "l1", stage: "prospeccao", valor_proposto: 30000, data_fechamento: null, motivo_perdido: null, created_at: "2026-04-01" },
                { id: "l2", stage: "comercial", valor_proposto: 50000, data_fechamento: null, motivo_perdido: null, created_at: "2026-03-15" },
                { id: "l3", stage: "ativo", valor_proposto: 40000, data_fechamento: "2026-04-10", motivo_perdido: null, created_at: "2026-02-01" },
                { id: "l4", stage: "ativo", valor_proposto: 60000, data_fechamento: "2026-04-25", motivo_perdido: null, created_at: "2026-02-15" },
                { id: "l5", stage: "comercial", valor_proposto: 20000, data_fechamento: null, motivo_perdido: "perdeu pra concorrente", created_at: "2026-04-05" },
              ],
            }),
          }),
        };
      }
      return {};
    });

    const r = await getLeadsKpis("u1", new Date(Date.UTC(2026, 3, 28)));
    // Ativos = não-ativos sem motivo_perdido = l1, l2 (l5 tem motivo_perdido)
    expect(r.leadsAtivos).toBe(2);
    // Fechamentos do mês de abril 2026 = l3, l4
    expect(r.fechamentosMes).toBe(2);
    // Ticket médio dos fechados nos últimos 90 dias = (40000 + 60000) / 2
    expect(r.ticketMedio).toBe(50000);
    // Taxa conversão últimos 90d = fechados / criados = 2 / 5 × 100 = 40
    expect(r.taxaConversao).toBeCloseTo(40);
  });

  it("retorna zeros quando comercial sem leads", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "leads") {
        return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [] }) }) };
      }
      return {};
    });

    const r = await getLeadsKpis("u1", new Date(Date.UTC(2026, 3, 28)));
    expect(r.leadsAtivos).toBe(0);
    expect(r.fechamentosMes).toBe(0);
    expect(r.ticketMedio).toBe(0);
    expect(r.taxaConversao).toBe(0);
  });
});

describe("getFunnelData", () => {
  it("retorna sempre 5 entries (uma por stage), mesmo quando vazias", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "leads") {
        return {
          select: () => ({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: "l1", stage: "prospeccao", valor_proposto: 10000 },
                { id: "l2", stage: "prospeccao", valor_proposto: 20000 },
                { id: "l3", stage: "ativo", valor_proposto: 50000 },
              ],
            }),
          }),
        };
      }
      return {};
    });

    const data = await getFunnelData("u1");
    expect(data).toHaveLength(5);
    expect(data.map((d) => d.stage)).toEqual(["prospeccao", "comercial", "contrato", "marco_zero", "ativo"]);
    expect(data[0].count).toBe(2);  // prospeccao
    expect(data[0].totalValor).toBe(30000);
    expect(data[1].count).toBe(0);  // comercial
    expect(data[4].count).toBe(1);  // ativo
  });
});

describe("getProximasReunioes", () => {
  it("une as 2 datas e ordena por data ascendente", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "leads") {
        return {
          select: () => ({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: "l1", nome_prospect: "A", data_prospeccao_agendada: "2026-04-30T10:00:00Z", data_reuniao_marco_zero: null },
                { id: "l2", nome_prospect: "B", data_prospeccao_agendada: null, data_reuniao_marco_zero: "2026-05-02T14:00:00Z" },
                { id: "l3", nome_prospect: "C", data_prospeccao_agendada: "2026-05-05T09:00:00Z", data_reuniao_marco_zero: "2026-04-29T16:00:00Z" },
              ],
            }),
          }),
        };
      }
      return {};
    });

    const r = await getProximasReunioes("u1", 14, new Date(Date.UTC(2026, 3, 28)));
    expect(r.length).toBeGreaterThanOrEqual(3);
    // Primeira reunião: l3 marco_zero (29-abr)
    expect(r[0].leadId).toBe("l3");
    expect(r[0].tipo).toBe("marco_zero");
    // Última (dentro do limite 14d): l3 prospeccao (5-mai) ou l2 marco_zero (2-mai) — ordem cronológica
    expect(r[r.length - 1].data >= r[0].data).toBe(true);
  });

  it("ignora datas no passado", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "leads") {
        return {
          select: () => ({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: "l1", nome_prospect: "A", data_prospeccao_agendada: "2026-04-15T10:00:00Z", data_reuniao_marco_zero: null }, // passado
              ],
            }),
          }),
        };
      }
      return {};
    });

    const r = await getProximasReunioes("u1", 14, new Date(Date.UTC(2026, 3, 28)));
    expect(r).toEqual([]);
  });
});

describe("getMetaComercial", () => {
  it("calcula meta = (3 × fixo) / (percentual / 100)", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { fixo_mensal: 3000, comissao_percent: 10, comissao_primeiro_mes_percent: 10 },
              }),
            }),
          }),
        };
      }
      if (table === "leads") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gte: () => ({
                  lte: vi.fn().mockResolvedValue({
                    data: [
                      { id: "l1", valor_proposto: 25000, data_fechamento: "2026-04-10" },
                    ],
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const r = await getMetaComercial("u1", new Date(Date.UTC(2026, 3, 28)));
    // Meta comissão = 3 × 3000 = 9000
    // Meta fechamento = 9000 / 0.10 = 90000
    expect(r.metaComissao).toBe(9000);
    expect(r.metaFechamento).toBe(90000);
    // Fechado: 25000
    expect(r.fechadoMes).toBe(25000);
    // Comissão atual: 25000 × 10% = 2500
    expect(r.comissaoAtual).toBe(2500);
    // pctMeta: 25000 / 90000 × 100 = 27.78
    expect(r.pctMeta).toBeCloseTo(27.78, 1);
    // status: < 30 = "abaixo"
    expect(r.status).toBe("abaixo");
  });

  it("retorna metaFechamento = 0 quando comissao_percent é 0 (proteção div/zero)", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { fixo_mensal: 3000, comissao_percent: 0, comissao_primeiro_mes_percent: 0 },
              }),
            }),
          }),
        };
      }
      if (table === "leads") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gte: () => ({ lte: vi.fn().mockResolvedValue({ data: [] }) }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const r = await getMetaComercial("u1", new Date(Date.UTC(2026, 3, 28)));
    expect(r.metaFechamento).toBe(0);
    expect(r.metaComissao).toBe(9000);
    expect(r.pctMeta).toBe(0);
    expect(r.status).toBe("abaixo");
  });

  it("status é 'atingido' quando pctMeta >= 100", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { fixo_mensal: 3000, comissao_percent: 10, comissao_primeiro_mes_percent: 10 },
              }),
            }),
          }),
        };
      }
      if (table === "leads") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gte: () => ({
                  lte: vi.fn().mockResolvedValue({
                    data: [{ id: "l1", valor_proposto: 100000, data_fechamento: "2026-04-10" }],
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const r = await getMetaComercial("u1", new Date(Date.UTC(2026, 3, 28)));
    expect(r.pctMeta).toBeGreaterThanOrEqual(100);
    expect(r.status).toBe("atingido");
  });
});
```

- [ ] **Step B2.2: Rodar tests, esperar falhar**

```bash
npm run test -- tests/unit/dashboard-comercial.test.ts
```

- [ ] **Step B2.3: Criar `src/lib/dashboard/comercial-queries.ts`**

```ts
// SERVER ONLY: do not import from client components
import { createClient } from "@/lib/supabase/server";
import { isInMonth } from "./date-utils";

export interface LeadsKpis {
  leadsAtivos: number;
  fechamentosMes: number;
  ticketMedio: number;
  taxaConversao: number;
}

interface LeadRow {
  id: string;
  stage: string;
  valor_proposto: number;
  data_fechamento: string | null;
  motivo_perdido: string | null;
  created_at: string;
}

export async function getLeadsKpis(comercialId: string, now: Date = new Date()): Promise<LeadsKpis> {
  const supabase = await createClient();
  const monthRef = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data } = await supabase
    .from("leads")
    .select("id, stage, valor_proposto, data_fechamento, motivo_perdido, created_at")
    .eq("comercial_id", comercialId);

  const leads = (data ?? []) as LeadRow[];

  const ativos = leads.filter((l) => l.stage !== "ativo" && !l.motivo_perdido).length;
  const fechadosNoMes = leads.filter((l) => l.stage === "ativo" && isInMonth(l.data_fechamento, monthRef));
  const fechamentosMes = fechadosNoMes.length;

  const fechadosUltimos90d = leads.filter(
    (l) => l.stage === "ativo" && l.data_fechamento && l.data_fechamento >= ninetyDaysAgo,
  );
  const ticketMedio =
    fechadosUltimos90d.length > 0
      ? fechadosUltimos90d.reduce((a, l) => a + Number(l.valor_proposto), 0) / fechadosUltimos90d.length
      : 0;

  const criadosUltimos90d = leads.filter((l) => l.created_at.slice(0, 10) >= ninetyDaysAgo);
  const taxaConversao =
    criadosUltimos90d.length > 0 ? (fechadosUltimos90d.length / criadosUltimos90d.length) * 100 : 0;

  return { leadsAtivos: ativos, fechamentosMes, ticketMedio, taxaConversao };
}

export type FunnelStageKey = "prospeccao" | "comercial" | "contrato" | "marco_zero" | "ativo";

export interface FunnelStage {
  stage: FunnelStageKey;
  label: string;
  count: number;
  totalValor: number;
}

const STAGE_LABELS: Record<FunnelStageKey, string> = {
  prospeccao: "Prospecção",
  comercial: "Em comercial",
  contrato: "Contrato",
  marco_zero: "Marco zero",
  ativo: "Ativo",
};

export async function getFunnelData(comercialId: string): Promise<FunnelStage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("id, stage, valor_proposto")
    .eq("comercial_id", comercialId);

  const leads = (data ?? []) as Array<{ id: string; stage: FunnelStageKey; valor_proposto: number }>;

  const stages: FunnelStageKey[] = ["prospeccao", "comercial", "contrato", "marco_zero", "ativo"];
  return stages.map((stage) => {
    const inStage = leads.filter((l) => l.stage === stage);
    return {
      stage,
      label: STAGE_LABELS[stage],
      count: inStage.length,
      totalValor: inStage.reduce((a, l) => a + Number(l.valor_proposto), 0),
    };
  });
}

export interface ProximaReuniao {
  leadId: string;
  nomeProspect: string;
  tipo: "prospeccao_agendada" | "marco_zero";
  data: string; // ISO
}

export async function getProximasReunioes(
  comercialId: string,
  days: number = 14,
  now: Date = new Date(),
): Promise<ProximaReuniao[]> {
  const supabase = await createClient();
  const startIso = now.toISOString();
  const endIso = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("leads")
    .select("id, nome_prospect, data_prospeccao_agendada, data_reuniao_marco_zero")
    .eq("comercial_id", comercialId);

  const leads = (data ?? []) as Array<{
    id: string;
    nome_prospect: string;
    data_prospeccao_agendada: string | null;
    data_reuniao_marco_zero: string | null;
  }>;

  const reunioes: ProximaReuniao[] = [];
  for (const l of leads) {
    if (l.data_prospeccao_agendada && l.data_prospeccao_agendada >= startIso && l.data_prospeccao_agendada <= endIso) {
      reunioes.push({
        leadId: l.id,
        nomeProspect: l.nome_prospect,
        tipo: "prospeccao_agendada",
        data: l.data_prospeccao_agendada,
      });
    }
    if (l.data_reuniao_marco_zero && l.data_reuniao_marco_zero >= startIso && l.data_reuniao_marco_zero <= endIso) {
      reunioes.push({
        leadId: l.id,
        nomeProspect: l.nome_prospect,
        tipo: "marco_zero",
        data: l.data_reuniao_marco_zero,
      });
    }
  }

  reunioes.sort((a, b) => a.data.localeCompare(b.data));
  return reunioes;
}

export interface MetaComercial {
  metaFechamento: number;
  metaComissao: number;
  fechadoMes: number;
  comissaoAtual: number;
  pctMeta: number;
  status: "abaixo" | "no-caminho" | "perto" | "atingido";
}

const META_MULTIPLIER = 3;

export async function getMetaComercial(userId: string, now: Date = new Date()): Promise<MetaComercial> {
  const supabase = await createClient();
  const monthRef = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const inicioMes = `${monthRef}-01`;
  const fimMes = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);

  const { data: profileData } = await supabase
    .from("profiles")
    .select("fixo_mensal, comissao_percent, comissao_primeiro_mes_percent")
    .eq("id", userId)
    .single();
  const profile = (profileData as { fixo_mensal: number; comissao_percent: number; comissao_primeiro_mes_percent: number } | null) ?? {
    fixo_mensal: 0,
    comissao_percent: 0,
    comissao_primeiro_mes_percent: 0,
  };

  const fixo = Number(profile.fixo_mensal);
  const pct = Number(profile.comissao_percent);
  const metaComissao = META_MULTIPLIER * fixo;
  const metaFechamento = pct > 0 ? metaComissao / (pct / 100) : 0;

  const { data: leadsData } = await supabase
    .from("leads")
    .select("id, valor_proposto, data_fechamento")
    .eq("comercial_id", userId)
    .eq("stage", "ativo")
    .gte("data_fechamento", inicioMes)
    .lte("data_fechamento", fimMes);

  const fechados = (leadsData ?? []) as Array<{ id: string; valor_proposto: number }>;
  const fechadoMes = fechados.reduce((a, l) => a + Number(l.valor_proposto), 0);
  const comissaoAtual = fechadoMes * (pct / 100);
  const pctMeta = metaFechamento > 0 ? (fechadoMes / metaFechamento) * 100 : 0;

  let status: MetaComercial["status"];
  if (pctMeta >= 100) status = "atingido";
  else if (pctMeta >= 80) status = "perto";
  else if (pctMeta >= 30) status = "no-caminho";
  else status = "abaixo";

  return { metaFechamento, metaComissao, fechadoMes, comissaoAtual, pctMeta, status };
}
```

- [ ] **Step B2.4: Rodar tests, esperar passar**

```bash
npm run test -- tests/unit/dashboard-comercial.test.ts
npm run typecheck
```

Esperar: 8/8 pass, typecheck clean.

- [ ] **Step B2.5: Commit**

```bash
git add src/lib/dashboard/comercial-queries.ts tests/unit/dashboard-comercial.test.ts
git commit -m "feat(dashboard): comercial queries (leads kpis, funnel, reunioes, meta) (TDD)"
```

---

## Bloco C — Components novos

### Task C1: `KpiRowCoord` + `KpiRowAssessor` (server)

**Files:**
- Create: `src/components/dashboard/KpiRowCoord.tsx`
- Create: `src/components/dashboard/KpiRowAssessor.tsx`

- [ ] **Step C1.1: Criar `KpiRowCoord.tsx`**

```tsx
import { Wallet, Users, TrendingDown, Percent, Coins } from "lucide-react";
import { KpiCard } from "./KpiCard";
import type { KpiData } from "@/lib/dashboard/queries";
import type { ComissaoPrevista } from "@/lib/dashboard/comissao-prevista";

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

function formatDelta(v: number, currency: boolean): { valor: string; direction: "up" | "down" | "neutral" } {
  if (v === 0) return { valor: currency ? "R$ 0" : "0", direction: "neutral" };
  const formatted = currency ? formatBRL(Math.abs(v)) : String(Math.abs(v));
  return { valor: formatted, direction: v > 0 ? "up" : "down" };
}

interface Props {
  kpis: KpiData;
  comissao: ComissaoPrevista;
}

export function KpiRowCoord({ kpis, comissao }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <KpiCard
        label="Carteira sob coord."
        valor={formatBRL(kpis.carteiraAtiva.valor)}
        delta={formatDelta(kpis.carteiraAtiva.deltaValor, true)}
        helperText="vs mês anterior"
        icon={Wallet}
      />
      <KpiCard
        label="Clientes ativos"
        valor={String(kpis.clientesAtivos.quantidade)}
        delta={formatDelta(kpis.clientesAtivos.deltaQuantidade, false)}
        helperText="vs mês anterior"
        icon={Users}
      />
      <KpiCard
        label="Churn do mês"
        valor={String(kpis.churnMes.quantidade)}
        helperText={`${formatBRL(kpis.churnMes.valorPerdido)} perdidos`}
        icon={TrendingDown}
      />
      <KpiCard
        label="Custo de comissão"
        valor={`${kpis.custoComissaoPct.pct.toFixed(1)}%`}
        helperText="da carteira"
        icon={Percent}
      />
      <KpiCard
        label="Minha comissão prevista"
        valor={formatBRL(comissao.valor)}
        helperText={`${comissao.percentual}% sobre ${formatBRL(comissao.baseCalculo)} + fixo ${formatBRL(comissao.fixo)}`}
        icon={Coins}
      />
    </div>
  );
}
```

- [ ] **Step C1.2: Criar `KpiRowAssessor.tsx`**

```tsx
import { Wallet, Users, TrendingDown, Coins } from "lucide-react";
import { KpiCard } from "./KpiCard";
import type { KpiData } from "@/lib/dashboard/queries";
import type { ComissaoPrevista } from "@/lib/dashboard/comissao-prevista";

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

function formatDelta(v: number, currency: boolean): { valor: string; direction: "up" | "down" | "neutral" } {
  if (v === 0) return { valor: currency ? "R$ 0" : "0", direction: "neutral" };
  const formatted = currency ? formatBRL(Math.abs(v)) : String(Math.abs(v));
  return { valor: formatted, direction: v > 0 ? "up" : "down" };
}

interface Props {
  kpis: KpiData;
  comissao: ComissaoPrevista;
}

export function KpiRowAssessor({ kpis, comissao }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Minha carteira"
        valor={formatBRL(kpis.carteiraAtiva.valor)}
        delta={formatDelta(kpis.carteiraAtiva.deltaValor, true)}
        helperText="vs mês anterior"
        icon={Wallet}
      />
      <KpiCard
        label="Meus clientes"
        valor={String(kpis.clientesAtivos.quantidade)}
        delta={formatDelta(kpis.clientesAtivos.deltaQuantidade, false)}
        helperText="vs mês anterior"
        icon={Users}
      />
      <KpiCard
        label="Meu churn"
        valor={String(kpis.churnMes.quantidade)}
        helperText={`${formatBRL(kpis.churnMes.valorPerdido)} perdidos`}
        icon={TrendingDown}
      />
      <KpiCard
        label="Minha comissão prevista"
        valor={formatBRL(comissao.valor)}
        helperText={`${comissao.percentual}% sobre ${formatBRL(comissao.baseCalculo)} + fixo ${formatBRL(comissao.fixo)}`}
        icon={Coins}
      />
    </div>
  );
}
```

- [ ] **Step C1.3: Typecheck e commit**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
npm run typecheck
git add src/components/dashboard/KpiRowCoord.tsx src/components/dashboard/KpiRowAssessor.tsx
git commit -m "feat(dashboard): KpiRowCoord and KpiRowAssessor components"
```

---

### Task C2: `KpiRowComercial` (server)

**Files:**
- Create: `src/components/dashboard/KpiRowComercial.tsx`

- [ ] **Step C2.1: Criar `KpiRowComercial.tsx`**

```tsx
import { Users, CheckCircle2, Coins, TrendingUp, Target } from "lucide-react";
import { KpiCard } from "./KpiCard";
import type { LeadsKpis } from "@/lib/dashboard/comercial-queries";
import type { ComissaoPrevista } from "@/lib/dashboard/comissao-prevista";

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

interface Props {
  leadsKpis: LeadsKpis;
  comissao: ComissaoPrevista;
}

export function KpiRowComercial({ leadsKpis, comissao }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <KpiCard
        label="Leads ativos"
        valor={String(leadsKpis.leadsAtivos)}
        helperText="em prospecção/comercial/contrato"
        icon={Users}
      />
      <KpiCard
        label="Fechamentos do mês"
        valor={String(leadsKpis.fechamentosMes)}
        helperText="leads convertidos em ativo"
        icon={CheckCircle2}
      />
      <KpiCard
        label="Ticket médio"
        valor={formatBRL(leadsKpis.ticketMedio)}
        helperText="últimos 90 dias"
        icon={TrendingUp}
      />
      <KpiCard
        label="Taxa de conversão"
        valor={`${leadsKpis.taxaConversao.toFixed(1)}%`}
        helperText="últimos 90 dias"
        icon={Target}
      />
      <KpiCard
        label="Minha comissão prevista"
        valor={formatBRL(comissao.valor)}
        helperText={`${comissao.percentual}% sobre ${formatBRL(comissao.baseCalculo)} + fixo ${formatBRL(comissao.fixo)}`}
        icon={Coins}
      />
    </div>
  );
}
```

- [ ] **Step C2.2: Typecheck e commit**

```bash
npm run typecheck
git add src/components/dashboard/KpiRowComercial.tsx
git commit -m "feat(dashboard): KpiRowComercial component"
```

---

### Task C3: `ChartFunil` (client, recharts)

**Files:**
- Create: `src/components/dashboard/ChartFunil.tsx`

- [ ] **Step C3.1: Criar `ChartFunil.tsx`**

```tsx
"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import type { FunnelStage } from "@/lib/dashboard/comercial-queries";

interface Props {
  data: FunnelStage[];
}

// Cores progressivas — mais saturadas conforme avança no funil
const STAGE_COLORS: Record<string, string> = {
  prospeccao: "#cbd5e1",   // slate-300
  comercial: "#94a3b8",    // slate-400
  contrato: "#5eead4",     // teal-300
  marco_zero: "#3DC4BC",   // brand teal
  ativo: "#0d9488",        // teal-600
};

function formatBRLShort(v: number): string {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(0)}k`;
  return `R$${v}`;
}

export function ChartFunil({ data }: Props) {
  const chartData = data.map((s) => ({
    label: s.label,
    stage: s.stage,
    count: s.count,
    totalValor: s.totalValor,
  }));

  return (
    <div className="h-64 w-full" aria-label="Gráfico de funil — 5 estágios">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={90} />
          <Tooltip
            formatter={(_value, _name, item) => {
              const payload = item.payload as { count: number; totalValor: number };
              return [`${payload.count} leads · ${formatBRLShort(payload.totalValor)}`, "Total"];
            }}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {chartData.map((entry) => (
              <Cell key={entry.stage} fill={STAGE_COLORS[entry.stage] ?? "#cbd5e1"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step C3.2: Typecheck e commit**

```bash
npm run typecheck
git add src/components/dashboard/ChartFunil.tsx
git commit -m "feat(dashboard): ChartFunil component (5 stages, recharts)"
```

---

### Task C4: `MetaTracker` (server)

**Files:**
- Create: `src/components/dashboard/MetaTracker.tsx`

- [ ] **Step C4.1: Criar `MetaTracker.tsx`**

```tsx
import { Trophy, TrendingUp } from "lucide-react";
import type { MetaComercial } from "@/lib/dashboard/comercial-queries";

interface Props {
  meta: MetaComercial;
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

const STATUS_FILL: Record<MetaComercial["status"], string> = {
  abaixo: "bg-muted-foreground/40",
  "no-caminho": "bg-amber-500",
  perto: "bg-primary",
  atingido: "bg-green-600",
};

const STATUS_LABEL: Record<MetaComercial["status"], string> = {
  abaixo: "Início do mês",
  "no-caminho": "No caminho",
  perto: "Quase lá",
  atingido: "Meta atingida",
};

export function MetaTracker({ meta }: Props) {
  const pctClamped = Math.min(meta.pctMeta, 100);
  const Icon = meta.status === "atingido" ? Trophy : TrendingUp;
  const restanteFechamento = Math.max(0, meta.metaFechamento - meta.fechadoMes);
  const restanteComissao = restanteFechamento * (meta.metaFechamento > 0 ? meta.metaComissao / meta.metaFechamento : 0);

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 mt-0.5 ${meta.status === "atingido" ? "text-green-600" : "text-primary"}`} />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold tracking-tight">Meta do mês</h3>
          <p className="text-xs text-muted-foreground">
            Fechar {formatBRL(meta.metaFechamento)} ≈ {formatBRL(meta.metaComissao)} em comissão
          </p>
        </div>
        <span className="text-xs font-medium text-muted-foreground">{STATUS_LABEL[meta.status]}</span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold tabular-nums">{formatBRL(meta.fechadoMes)}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{meta.pctMeta.toFixed(0)}% da meta</span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full transition-all ${STATUS_FILL[meta.status]}`}
            style={{ width: `${pctClamped}%` }}
          />
        </div>
      </div>

      <div className="text-xs">
        {meta.status === "atingido" ? (
          <p className="text-green-700 dark:text-green-400 font-medium">
            🎉 Meta atingida! Você já garantiu {formatBRL(meta.comissaoAtual)} de comissão variável este mês.
          </p>
        ) : (
          <p className="text-muted-foreground">
            Faltam {formatBRL(restanteFechamento)} → mais {formatBRL(restanteComissao)} de comissão se atingir.
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step C4.2: Typecheck e commit**

```bash
npm run typecheck
git add src/components/dashboard/MetaTracker.tsx
git commit -m "feat(dashboard): MetaTracker component (auto goal = 3x fixo)"
```

---

### Task C5: `ProximasReunioesList` (server)

**Files:**
- Create: `src/components/dashboard/ProximasReunioesList.tsx`

- [ ] **Step C5.1: Criar `ProximasReunioesList.tsx`**

```tsx
import Link from "next/link";
import { Briefcase, Handshake } from "lucide-react";
import type { ProximaReuniao } from "@/lib/dashboard/comercial-queries";

interface Props {
  reunioes: ProximaReuniao[];
}

const TIPO_LABEL = {
  prospeccao_agendada: "Prospecção",
  marco_zero: "Marco zero",
};

const TIPO_ICON = {
  prospeccao_agendada: Briefcase,
  marco_zero: Handshake,
};

const TIPO_COLOR = {
  prospeccao_agendada: "text-blue-600 dark:text-blue-400",
  marco_zero: "text-purple-600 dark:text-purple-400",
};

function formatRelative(iso: string): string {
  const eventDate = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const eventDay = new Date(eventDate);
  eventDay.setHours(0, 0, 0, 0);

  if (eventDay.getTime() === today.getTime()) {
    return `Hoje, ${eventDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (eventDay.getTime() === tomorrow.getTime()) {
    return `Amanhã, ${eventDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return eventDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function ProximasReunioesList({ reunioes }: Props) {
  if (reunioes.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Sem reuniões nos próximos 14 dias.</p>;
  }

  return (
    <ul className="space-y-2">
      {reunioes.map((r) => {
        const Icon = TIPO_ICON[r.tipo];
        return (
          <li key={`${r.leadId}-${r.tipo}`} className="flex items-center gap-3 text-sm">
            <Icon className={`h-4 w-4 shrink-0 ${TIPO_COLOR[r.tipo]}`} />
            <div className="min-w-0 flex-1">
              <Link href={`/onboarding/${r.leadId}`} className="font-medium hover:underline truncate block">
                {r.nomeProspect}
              </Link>
              <div className="text-xs text-muted-foreground">
                {TIPO_LABEL[r.tipo]} · {formatRelative(r.data)}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step C5.2: Typecheck e commit**

```bash
npm run typecheck
git add src/components/dashboard/ProximasReunioesList.tsx
git commit -m "feat(dashboard): ProximasReunioesList component (leads-based)"
```

---

## Bloco D — Composição + page dispatcher

### Task D1: `DashboardCoord`

**Files:**
- Create: `src/components/dashboard/DashboardCoord.tsx`

- [ ] **Step D1.1: Criar `DashboardCoord.tsx`**

```tsx
import {
  getKpis,
  getCarteiraTimeline,
  getEntradaChurn,
  getCarteiraPorAssessor,
  getRankingSatisfacao,
  getProximosEventos,
} from "@/lib/dashboard/queries";
import { getComissaoPrevista } from "@/lib/dashboard/comissao-prevista";
import { KpiRowCoord } from "./KpiRowCoord";
import { ChartCarteiraTimeline } from "./ChartCarteiraTimeline";
import { ChartEntradaChurn } from "./ChartEntradaChurn";
import { CarteiraPorAssessorList } from "./CarteiraPorAssessorList";
import { RankingResumo } from "./RankingResumo";
import { ProximosEventosList } from "./ProximosEventosList";
import { Section } from "./Section";

interface Props {
  userId: string;
  nome: string;
}

export async function DashboardCoord({ userId, nome }: Props) {
  const filter = { coordenadorId: userId };

  const [kpis, carteiraTimeline, entradaChurn, carteiraPorAssessor, ranking, eventos, comissao] =
    await Promise.all([
      getKpis(undefined, filter),
      getCarteiraTimeline(12, undefined, filter),
      getEntradaChurn(6, undefined, filter),
      getCarteiraPorAssessor(filter),
      getRankingSatisfacao(filter),
      getProximosEventos(30, 10, { userId }),
      getComissaoPrevista(userId, "coordenador"),
    ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Olá, {nome.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">Visão da sua coordenação</p>
      </header>

      <KpiRowCoord kpis={kpis} comissao={comissao} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Evolução da carteira" subtitle="Últimos 12 meses">
          <ChartCarteiraTimeline data={carteiraTimeline} />
        </Section>
        <Section title="Entrada vs Churn" subtitle="Últimos 6 meses">
          <ChartEntradaChurn data={entradaChurn} />
        </Section>
      </div>

      <Section title="Carteira por assessor (sob sua coordenação)">
        <CarteiraPorAssessorList items={carteiraPorAssessor} />
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Satisfação dos meus clientes" cta={{ href: "/satisfacao", label: "Ver completo →" }}>
          <RankingResumo top={ranking.top} bottom={ranking.bottom} />
        </Section>
        <Section title="Próximos eventos meus" cta={{ href: "/calendario", label: "Ver agenda →" }}>
          <ProximosEventosList eventos={eventos} />
        </Section>
      </div>
    </div>
  );
}
```

- [ ] **Step D1.2: Typecheck e commit**

```bash
npm run typecheck
git add src/components/dashboard/DashboardCoord.tsx
git commit -m "feat(dashboard): DashboardCoord composition"
```

---

### Task D2: `DashboardAssessor`

**Files:**
- Create: `src/components/dashboard/DashboardAssessor.tsx`

- [ ] **Step D2.1: Criar `DashboardAssessor.tsx`**

```tsx
import {
  getKpis,
  getCarteiraTimeline,
  getEntradaChurn,
  getRankingSatisfacao,
  getProximosEventos,
} from "@/lib/dashboard/queries";
import { getComissaoPrevista } from "@/lib/dashboard/comissao-prevista";
import { KpiRowAssessor } from "./KpiRowAssessor";
import { ChartCarteiraTimeline } from "./ChartCarteiraTimeline";
import { ChartEntradaChurn } from "./ChartEntradaChurn";
import { RankingResumo } from "./RankingResumo";
import { ProximosEventosList } from "./ProximosEventosList";
import { Section } from "./Section";

interface Props {
  userId: string;
  nome: string;
}

export async function DashboardAssessor({ userId, nome }: Props) {
  const filter = { assessorId: userId };

  const [kpis, carteiraTimeline, entradaChurn, ranking, eventos, comissao] = await Promise.all([
    getKpis(undefined, filter),
    getCarteiraTimeline(12, undefined, filter),
    getEntradaChurn(6, undefined, filter),
    getRankingSatisfacao(filter),
    getProximosEventos(30, 10, { userId }),
    getComissaoPrevista(userId, "assessor"),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Olá, {nome.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">Sua carteira</p>
      </header>

      <KpiRowAssessor kpis={kpis} comissao={comissao} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Evolução da minha carteira" subtitle="Últimos 12 meses">
          <ChartCarteiraTimeline data={carteiraTimeline} />
        </Section>
        <Section title="Entrada vs Churn" subtitle="Últimos 6 meses">
          <ChartEntradaChurn data={entradaChurn} />
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Satisfação dos meus clientes" cta={{ href: "/satisfacao", label: "Ver completo →" }}>
          <RankingResumo top={ranking.top} bottom={ranking.bottom} />
        </Section>
        <Section title="Próximos eventos meus" cta={{ href: "/calendario", label: "Ver agenda →" }}>
          <ProximosEventosList eventos={eventos} />
        </Section>
      </div>
    </div>
  );
}
```

- [ ] **Step D2.2: Typecheck e commit**

```bash
npm run typecheck
git add src/components/dashboard/DashboardAssessor.tsx
git commit -m "feat(dashboard): DashboardAssessor composition"
```

---

### Task D3: `DashboardComercial`

**Files:**
- Create: `src/components/dashboard/DashboardComercial.tsx`

- [ ] **Step D3.1: Criar `DashboardComercial.tsx`**

```tsx
import {
  getLeadsKpis,
  getFunnelData,
  getProximasReunioes,
  getMetaComercial,
} from "@/lib/dashboard/comercial-queries";
import { getComissaoPrevista } from "@/lib/dashboard/comissao-prevista";
import { KpiRowComercial } from "./KpiRowComercial";
import { ChartFunil } from "./ChartFunil";
import { MetaTracker } from "./MetaTracker";
import { ProximasReunioesList } from "./ProximasReunioesList";
import { Section } from "./Section";

interface Props {
  userId: string;
  nome: string;
}

export async function DashboardComercial({ userId, nome }: Props) {
  const [leadsKpis, funnel, reunioes, meta, comissao] = await Promise.all([
    getLeadsKpis(userId),
    getFunnelData(userId),
    getProximasReunioes(userId, 14),
    getMetaComercial(userId),
    getComissaoPrevista(userId, "comercial"),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Olá, {nome.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">Sua prospecção</p>
      </header>

      <KpiRowComercial leadsKpis={leadsKpis} comissao={comissao} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Funil de conversão" subtitle="5 estágios atuais">
          <ChartFunil data={funnel} />
        </Section>
        <MetaTracker meta={meta} />
      </div>

      <Section title="Próximas reuniões" subtitle="Próximos 14 dias" cta={{ href: "/onboarding", label: "Ver kanban →" }}>
        <ProximasReunioesList reunioes={reunioes} />
      </Section>
    </div>
  );
}
```

- [ ] **Step D3.2: Typecheck e commit**

```bash
npm run typecheck
git add src/components/dashboard/DashboardComercial.tsx
git commit -m "feat(dashboard): DashboardComercial composition"
```

---

### Task D4: Page dispatcher + e2e + push + PR

**Files:**
- Modify: `src/app/(authed)/page.tsx`

- [ ] **Step D4.1: Substituir `src/app/(authed)/page.tsx`**

```tsx
import { requireAuth } from "@/lib/auth/session";
import { DashboardSocioAdm } from "@/components/dashboard/DashboardSocioAdm";
import { DashboardCoord } from "@/components/dashboard/DashboardCoord";
import { DashboardAssessor } from "@/components/dashboard/DashboardAssessor";
import { DashboardComercial } from "@/components/dashboard/DashboardComercial";
import { StubGreeting } from "@/components/dashboard/StubGreeting";

export default async function DashboardPage() {
  const user = await requireAuth();

  if (user.role === "socio" || user.role === "adm") {
    return <DashboardSocioAdm nome={user.nome} />;
  }
  if (user.role === "coordenador") {
    return <DashboardCoord userId={user.id} nome={user.nome} />;
  }
  if (user.role === "assessor") {
    return <DashboardAssessor userId={user.id} nome={user.nome} />;
  }
  if (user.role === "comercial") {
    return <DashboardComercial userId={user.id} nome={user.nome} />;
  }
  return <StubGreeting nome={user.nome} />;
}
```

- [ ] **Step D4.2: Rodar todos os testes + typecheck**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
npm run test
npm run typecheck
```

Esperar: typecheck clean. Pelo menos 41 testes do dashboard passam (28 prior + 5 comissao + 8 comercial). 1 falha pré-existente flaky em `tarefas-schema` é OK.

- [ ] **Step D4.3: Commit da page**

```bash
git add "src/app/(authed)/page.tsx"
git commit -m "feat(dashboard): page dispatcher for 5 role-specific dashboards"
```

- [ ] **Step D4.4: Push e abrir PR**

```bash
git push -u origin claude/fase-9-1-dashboards
```

```bash
/opt/homebrew/bin/gh pr create --base main --head claude/fase-9-1-dashboards \
  --title "feat: Fase 9.1 — Dashboards Coord + Assessor + Comercial" \
  --body "$(cat <<'EOF'
## Summary
- Adiciona dashboards específicos para Coordenador, Assessor e Comercial
- Reusa queries da Fase 9 parametrizadas com filter opcional (DRY)
- KPI "comissão prevista" com cálculo ao vivo em todos os 3 dashboards
- ChartFunil novo (5 estágios) e MetaTracker (meta automática 3× fixo) só pro Comercial
- ProximasReunioesList lendo da tabela leads (data_prospeccao_agendada + data_reuniao_marco_zero)
- Outros papéis (videomaker, designer, editor, audiovisual_chefe) continuam com StubGreeting

## Test plan
- [x] ~13 testes unitários novos (filter on existing queries + comissão + comercial)
- [x] Typecheck clean
- [x] Reusa componentes Fase 9 (KpiCard, charts, lists, Section)
- [ ] Verificar Production deploy depois do merge
- [ ] Validar visualmente em produção (cada papel com seu dashboard)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step D4.5: Verificar Production deploy depois do merge**

```bash
/opt/homebrew/bin/gh api "repos/time-yide/yide-acompanha/deployments?environment=Production" --jq '.[0].id' \
  | xargs -I {} /opt/homebrew/bin/gh api repos/time-yide/yide-acompanha/deployments/{}/statuses --jq '.[0].state'
```

Esperar: `success`.

---

## Self-Review

### Cobertura do spec — seção 5.9 (Coord + Assessor + Comercial)

| Spec | Coberto por |
|---|---|
| Coord: KPIs filtrados (carteira sob coord, ativos, churn, comissão prevista) | A1 (filter) + B1 (comissão) + C1 (KpiRowCoord) + D1 |
| Coord: gráficos filtrados | A1 + A2 + D1 |
| Coord: carteira por assessor (só coordenados) | A2 + D1 |
| Coord: ranking satisfação só dos clientes sob coord | A2 + D1 |
| Coord: próximos eventos do user | A2 + D1 |
| Assessor: KPIs próprios | A1 + B1 + C1 (KpiRowAssessor) + D2 |
| Assessor: gráfico evolução da minha carteira | A1 + D2 |
| Assessor: gráfico entrada vs churn (adicionado depois do brainstorming) | A1 + D2 |
| Assessor: ranking dos meus clientes | A2 + D2 |
| Assessor: próximos eventos meus | A2 + D2 |
| Comercial: KPIs (leads, fechamentos, ticket, conversão, comissão) | B2 + C2 + D3 |
| Comercial: funil 5 estágios | B2 + C3 + D3 |
| Comercial: próximas reuniões | B2 + C5 + D3 |
| Comercial: meta tracker (auto 3× fixo) | B2 + C4 + D3 |
| Outros papéis: stub continuado | D4 (page dispatcher mantém branch StubGreeting) |
| Sócio/ADM: comportamento idêntico ao da Fase 9 | A3 (extração sem mudança comportamental) |

### Lacunas conhecidas (intencionais)

- Sem UI de configuração de meta — Fase 10
- Sem comparação histórica entre comerciais — futuro
- Sem testes E2E novos (auth-redirect pra `/` já existe)
- Sem testes de integração com banco real (mocks de Supabase)

---

## Resumo da entrega

Após executar:

- 6 queries da Fase 9 parametrizadas com `ClientFilter`/`EventoFilter` opcional
- 1 nova função `getComissaoPrevista` (cálculo ao vivo, 3 papéis)
- 4 novas funções comerciais (`getLeadsKpis`, `getFunnelData`, `getProximasReunioes`, `getMetaComercial`)
- 6 novos componentes UI (3 KpiRows, ChartFunil, MetaTracker, ProximasReunioesList)
- 4 dashboards-componentes que compõem queries+UI (Sócio/ADM, Coord, Assessor, Comercial)
- Page raiz vira dispatcher com 5 branches
- ~13 testes unitários novos

Total: **~14 commits** (A1, A2, A3, B1, B2, C1, C2, C3, C4, C5, D1, D2, D3, D4).
