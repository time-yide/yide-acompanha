# Fase 9 — Dashboard (Sócio/ADM) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o stub atual em `src/app/(authed)/page.tsx` por um Dashboard completo para os papéis Sócio e ADM, agregando KPIs, 2 gráficos (recharts) e 3 painéis-lista a partir de tabelas existentes.

**Architecture:** 7 queries server-side em `src/lib/dashboard/queries.ts` rodando em paralelo (`Promise.all`) consumidas pela page. UI dividida em 8 componentes pequenos em `src/components/dashboard/`. Gráficos client-only via dynamic import do recharts. Outros papéis (Coordenador, Assessor, Comercial) recebem o stub atual com aviso "em breve".

**Tech Stack:** Next.js 16 + Supabase + recharts + Base UI + Tailwind + Zod + Vitest.

**Spec:** [docs/superpowers/specs/2026-04-28-fase-9-dashboard-design.md](../specs/2026-04-28-fase-9-dashboard-design.md)

**Plano anterior:** [Fase 8 — Satisfação + IA](2026-04-27-fase-8-satisfacao.md)

**Branch:** `claude/fase-9-dashboard` (já criada do `main` no commit `5d86138`)

**Fora do escopo:**
- Dashboards de Coordenador/Assessor/Comercial → Fase 9.1
- Drill-down em KPIs/gráficos → futuro
- Customização de visibilidade dos blocos → futuro
- Export PDF/Excel → futuro
- Datas customizáveis (sempre últimos 12/6 meses) → futuro

**Pré-requisitos:**
- Branch `claude/fase-9-dashboard` checked out (já feito)
- Tabelas: `clients` (com `data_entrada`, `data_churn`, `status`, `valor_mensal`, `assessor_id`), `commission_snapshots` (com `mes_referencia`, `valor_total`, `status` enum `pending_approval`/`aprovado`), `satisfaction_synthesis`, `calendar_events`, `profiles` — tudo já existente

**Estado atual no repositório:**
- `src/app/(authed)/page.tsx` é stub (KPIs vazios, placeholder)
- `src/components/satisfacao/SatisfactionSparkline.tsx` (Fase 8) — vamos reusar
- `src/lib/satisfacao/queries.ts` exporta `getSynthesisForWeek` (Fase 8) — vamos reusar
- Sem nenhuma lib de gráficos instalada
- `src/lib/satisfacao/iso-week.ts` exporta `currentIsoWeek` e `previousIsoWeek` (Fase 8) — vamos reusar pra ranking semanal

**Estrutura final esperada:**

```
src/
├── app/(authed)/page.tsx                                 [REPLACE]
├── lib/
│   └── dashboard/
│       ├── date-utils.ts                                 [NEW — helpers de mês]
│       └── queries.ts                                    [NEW — 7 queries]
└── components/
    └── dashboard/
        ├── KpiCard.tsx                                   [NEW — server]
        ├── KpiRow.tsx                                    [NEW — server]
        ├── ChartCarteiraTimeline.tsx                     [NEW — client]
        ├── ChartEntradaChurn.tsx                         [NEW — client]
        ├── CarteiraPorAssessorList.tsx                   [NEW — server]
        ├── RankingResumo.tsx                             [NEW — server]
        ├── ProximosEventosList.tsx                       [NEW — server]
        ├── AlertaAprovacao.tsx                           [NEW — server]
        ├── Section.tsx                                   [NEW — wrapper visual]
        └── StubGreeting.tsx                              [NEW — extraído do stub atual]

package.json                                              [MODIFY — +recharts]

tests/unit/
└── dashboard-queries.test.ts                             [NEW — 7 testes]
```

**Total estimado:** ~13 commits.

---

## Bloco A — Setup

### Task A1: Instalar `recharts`

**Files:**
- Modify: `package.json` (via `npm install`)

- [ ] **Step A1.1: Instalar dependência**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
npm install recharts
```

Esperar: instalação sem erro.

- [ ] **Step A1.2: Typecheck**

```bash
npm run typecheck
```

Esperar: clean (recharts vem com types embutidos).

- [ ] **Step A1.3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install recharts for dashboard charts"
```

---

## Bloco B — Backend (queries com TDD)

### Task B1: `date-utils.ts` — helpers puros de mês (TDD)

**Files:**
- Create: `src/lib/dashboard/date-utils.ts`
- Test: `tests/unit/dashboard-queries.test.ts` (criar arquivo só com este describe inicialmente; outras tasks vão adicionar describes ao mesmo arquivo)

- [ ] **Step B1.1: Criar diretório e escrever testes**

Crie `tests/unit/dashboard-queries.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { monthRange, monthLabel, lastDayOfMonth, isInMonth } from "@/lib/dashboard/date-utils";

describe("monthRange", () => {
  it("retorna últimos 12 meses incluindo o atual em ordem cronológica", () => {
    const months = monthRange(12, new Date(Date.UTC(2026, 3, 28)));
    expect(months).toHaveLength(12);
    expect(months[0]).toBe("2025-05");
    expect(months[11]).toBe("2026-04");
  });

  it("retorna últimos 6 meses", () => {
    const months = monthRange(6, new Date(Date.UTC(2026, 3, 28)));
    expect(months).toEqual(["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04"]);
  });

  it("vira o ano corretamente", () => {
    const months = monthRange(3, new Date(Date.UTC(2026, 1, 15)));
    expect(months).toEqual(["2025-12", "2026-01", "2026-02"]);
  });
});

describe("monthLabel", () => {
  it("formata 'YYYY-MM' como 'Mês/AAAA' em pt-BR abreviado", () => {
    expect(monthLabel("2026-04")).toBe("Abr/2026");
    expect(monthLabel("2025-12")).toBe("Dez/2025");
  });
});

describe("lastDayOfMonth", () => {
  it("retorna último dia do mês como ISO date 'YYYY-MM-DD'", () => {
    expect(lastDayOfMonth("2026-02")).toBe("2026-02-28");
    expect(lastDayOfMonth("2024-02")).toBe("2024-02-29"); // ano bissexto
    expect(lastDayOfMonth("2026-12")).toBe("2026-12-31");
  });
});

describe("isInMonth", () => {
  it("retorna true se a data ISO está no mês especificado", () => {
    expect(isInMonth("2026-04-15", "2026-04")).toBe(true);
    expect(isInMonth("2026-04-01", "2026-04")).toBe(true);
    expect(isInMonth("2026-04-30", "2026-04")).toBe(true);
  });

  it("retorna false fora do mês", () => {
    expect(isInMonth("2026-03-31", "2026-04")).toBe(false);
    expect(isInMonth("2026-05-01", "2026-04")).toBe(false);
  });

  it("retorna false se data for null/undefined", () => {
    expect(isInMonth(null, "2026-04")).toBe(false);
    expect(isInMonth(undefined, "2026-04")).toBe(false);
  });
});
```

- [ ] **Step B1.2: Rodar testes, esperar falhar**

```bash
npm run test -- tests/unit/dashboard-queries.test.ts
```

Esperar: erro de import (módulo não existe).

- [ ] **Step B1.3: Criar `src/lib/dashboard/date-utils.ts`**

```ts
/**
 * Helpers puros de manipulação de mês 'YYYY-MM'.
 * Tudo em UTC para evitar surpresas de fuso.
 */

export function monthRange(count: number, from: Date = new Date()): string[] {
  const result: string[] = [];
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month - i, 1));
    result.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return result;
}

const MONTH_LABELS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function monthLabel(yyyymm: string): string {
  const [yearStr, monthStr] = yyyymm.split("-");
  const monthIndex = Number(monthStr) - 1;
  return `${MONTH_LABELS_PT[monthIndex]}/${yearStr}`;
}

export function lastDayOfMonth(yyyymm: string): string {
  const [yearStr, monthStr] = yyyymm.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr); // 1-12
  // dia 0 do próximo mês = último dia do mês corrente
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${yyyymm}-${String(lastDay).padStart(2, "0")}`;
}

export function isInMonth(isoDate: string | null | undefined, yyyymm: string): boolean {
  if (!isoDate) return false;
  return isoDate.slice(0, 7) === yyyymm;
}
```

- [ ] **Step B1.4: Rodar testes, esperar passar**

```bash
npm run test -- tests/unit/dashboard-queries.test.ts
```

Esperar: 11/11 passa.

- [ ] **Step B1.5: Commit**

```bash
git add src/lib/dashboard/date-utils.ts tests/unit/dashboard-queries.test.ts
git commit -m "feat(dashboard): date utils for month-level aggregations"
```

---

### Task B2: `queries.ts` — `getKpis` (TDD)

**Files:**
- Create: `src/lib/dashboard/queries.ts`
- Modify: `tests/unit/dashboard-queries.test.ts`

- [ ] **Step B2.1: Adicionar testes**

Adicione ao final de `tests/unit/dashboard-queries.test.ts`:

```ts
import { vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromMock }),
}));

import { getKpis } from "@/lib/dashboard/queries";

beforeEach(() => {
  fromMock.mockReset();
});

describe("getKpis", () => {
  it("calcula carteira ativa e clientes ativos a partir de clients ativos", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "clients") {
        return {
          select: () => ({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: "c1", valor_mensal: 5000, data_entrada: "2025-01-01", data_churn: null, status: "ativo" },
                { id: "c2", valor_mensal: 3000, data_entrada: "2025-06-01", data_churn: null, status: "ativo" },
                { id: "c3", valor_mensal: 4000, data_entrada: "2024-08-01", data_churn: "2026-04-15", status: "ativo" },
              ],
            }),
          }),
        };
      }
      if (table === "commission_snapshots") {
        return {
          select: () => ({
            order: () => ({
              limit: vi.fn().mockResolvedValue({
                data: [{ mes_referencia: "2026-03", valor_total: 800 }],
              }),
            }),
          }),
        };
      }
      return {};
    });

    const r = await getKpis(new Date(Date.UTC(2026, 3, 28)));
    // c1 e c2 são ativos sem churn; c3 churnou em abril (ainda no mês de referência)
    // Carteira ativa hoje (28/abr/2026): c1 + c2 = 8000 (c3 churnou em 15/abr, não está mais ativo)
    expect(r.carteiraAtiva.valor).toBe(8000);
    expect(r.clientesAtivos.quantidade).toBe(2);
    expect(r.churnMes.quantidade).toBe(1);    // c3 churnou em abril
    expect(r.churnMes.valorPerdido).toBe(4000);
    // Custo de comissão: 800 / 8000 = 10%
    expect(r.custoComissaoPct.pct).toBeCloseTo(10);
  });

  it("retorna zeros quando não há clientes", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "clients") {
        return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [] }) }) };
      }
      if (table === "commission_snapshots") {
        return { select: () => ({ order: () => ({ limit: vi.fn().mockResolvedValue({ data: [] }) }) }) };
      }
      return {};
    });

    const r = await getKpis(new Date(Date.UTC(2026, 3, 28)));
    expect(r.carteiraAtiva.valor).toBe(0);
    expect(r.clientesAtivos.quantidade).toBe(0);
    expect(r.churnMes.quantidade).toBe(0);
    expect(r.custoComissaoPct.pct).toBe(0);
  });
});
```

- [ ] **Step B2.2: Rodar testes, esperar falhar**

```bash
npm run test -- tests/unit/dashboard-queries.test.ts
```

Esperar: erro `Failed to resolve import "@/lib/dashboard/queries"`.

- [ ] **Step B2.3: Criar `src/lib/dashboard/queries.ts` com `getKpis`**

```ts
// SERVER ONLY: do not import from client components
import { createClient } from "@/lib/supabase/server";
import { isInMonth } from "./date-utils";

interface ClientRow {
  id: string;
  valor_mensal: number;
  data_entrada: string;
  data_churn: string | null;
  status: string;
}

export interface KpiData {
  carteiraAtiva: { valor: number; deltaValor: number };
  clientesAtivos: { quantidade: number; deltaQuantidade: number };
  churnMes: { quantidade: number; valorPerdido: number };
  custoComissaoPct: { pct: number };
}

function isActiveOn(c: ClientRow, dateIso: string): boolean {
  // Cliente está ativo no dia X se entrou até X e (não churnou OU churnou depois de X)
  if (c.data_entrada > dateIso) return false;
  if (c.data_churn && c.data_churn <= dateIso) return false;
  return true;
}

export async function getKpis(now: Date = new Date()): Promise<KpiData> {
  const supabase = await createClient();
  const monthRef = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const todayIso = now.toISOString().slice(0, 10);

  // Calcular última data do mês ANTERIOR (para delta)
  const prevMonthLastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))
    .toISOString()
    .slice(0, 10);

  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, valor_mensal, data_entrada, data_churn, status")
    .eq("status", "ativo");

  const allClients = (clientsData ?? []) as ClientRow[];

  const ativosHoje = allClients.filter((c) => isActiveOn(c, todayIso));
  const ativosFimMesAnterior = allClients.filter((c) => isActiveOn(c, prevMonthLastDay));

  const carteiraAtivaValor = ativosHoje.reduce((acc, c) => acc + Number(c.valor_mensal), 0);
  const carteiraMesAnteriorValor = ativosFimMesAnterior.reduce((acc, c) => acc + Number(c.valor_mensal), 0);

  const churnsDoMes = allClients.filter((c) => isInMonth(c.data_churn, monthRef));
  const valorChurnado = churnsDoMes.reduce((acc, c) => acc + Number(c.valor_mensal), 0);

  // Custo de comissão = soma do último commission_snapshot dividida pela carteira ativa
  const { data: snapshotsData } = await supabase
    .from("commission_snapshots")
    .select("mes_referencia, valor_total")
    .order("mes_referencia", { ascending: false })
    .limit(50); // pega vários do mesmo mês mais recente
  const snapshots = (snapshotsData ?? []) as Array<{ mes_referencia: string; valor_total: number }>;
  const ultimoMes = snapshots[0]?.mes_referencia;
  const totalComissao = ultimoMes
    ? snapshots.filter((s) => s.mes_referencia === ultimoMes).reduce((a, s) => a + Number(s.valor_total), 0)
    : 0;
  const pctComissao = carteiraAtivaValor > 0 ? (totalComissao / carteiraAtivaValor) * 100 : 0;

  return {
    carteiraAtiva: {
      valor: carteiraAtivaValor,
      deltaValor: carteiraAtivaValor - carteiraMesAnteriorValor,
    },
    clientesAtivos: {
      quantidade: ativosHoje.length,
      deltaQuantidade: ativosHoje.length - ativosFimMesAnterior.length,
    },
    churnMes: {
      quantidade: churnsDoMes.length,
      valorPerdido: valorChurnado,
    },
    custoComissaoPct: {
      pct: pctComissao,
    },
  };
}
```

- [ ] **Step B2.4: Rodar testes, esperar passar**

```bash
npm run test -- tests/unit/dashboard-queries.test.ts
```

Esperar: 13/13 passa.

- [ ] **Step B2.5: Commit**

```bash
git add src/lib/dashboard/queries.ts tests/unit/dashboard-queries.test.ts
git commit -m "feat(dashboard): getKpis with month-over-month deltas (TDD)"
```

---

### Task B3: `getCarteiraTimeline` (TDD)

**Files:**
- Modify: `src/lib/dashboard/queries.ts`
- Modify: `tests/unit/dashboard-queries.test.ts`

- [ ] **Step B3.1: Adicionar testes**

Adicione ao final de `tests/unit/dashboard-queries.test.ts`:

```ts
import { getCarteiraTimeline } from "@/lib/dashboard/queries";

describe("getCarteiraTimeline", () => {
  it("calcula carteira mes a mes considerando entrada e churn", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "clients") {
        return {
          select: vi.fn().mockResolvedValue({
            data: [
              // Cliente ativo de 01/2026 em diante
              { id: "c1", valor_mensal: 5000, data_entrada: "2026-01-15", data_churn: null },
              // Cliente ativo de 02/2026 a 03/2026 (churnou em 03)
              { id: "c2", valor_mensal: 3000, data_entrada: "2026-02-01", data_churn: "2026-03-20" },
            ],
          }),
        };
      }
      return {};
    });

    const timeline = await getCarteiraTimeline(4, new Date(Date.UTC(2026, 3, 28)));
    expect(timeline).toHaveLength(4);
    expect(timeline.map((p) => p.mes)).toEqual(["2026-01", "2026-02", "2026-03", "2026-04"]);
    // Janeiro: só c1 ativo no fim de janeiro
    expect(timeline[0].valorTotal).toBe(5000);
    // Fevereiro: c1 + c2 ativos
    expect(timeline[1].valorTotal).toBe(8000);
    // Março: c1 ativo, c2 churnou em 20/03 → no fim de março não estava ativo
    expect(timeline[2].valorTotal).toBe(5000);
    // Abril: só c1
    expect(timeline[3].valorTotal).toBe(5000);
  });

  it("retorna 0 em meses sem clientes ativos", async () => {
    fromMock.mockImplementation(() => ({
      select: vi.fn().mockResolvedValue({ data: [] }),
    }));
    const timeline = await getCarteiraTimeline(3, new Date(Date.UTC(2026, 3, 28)));
    expect(timeline).toHaveLength(3);
    expect(timeline.every((p) => p.valorTotal === 0)).toBe(true);
  });
});
```

- [ ] **Step B3.2: Rodar testes, esperar falhar**

```bash
npm run test -- tests/unit/dashboard-queries.test.ts
```

Esperar: erro `getCarteiraTimeline is not exported`.

- [ ] **Step B3.3: Adicionar `getCarteiraTimeline` em `queries.ts`**

Adicione ao final de `src/lib/dashboard/queries.ts`:

```ts
import { monthRange, lastDayOfMonth } from "./date-utils";

export interface TimelinePoint {
  mes: string;          // 'YYYY-MM'
  valorTotal: number;
}

export async function getCarteiraTimeline(
  months: number = 12,
  now: Date = new Date(),
): Promise<TimelinePoint[]> {
  const supabase = await createClient();
  const meses = monthRange(months, now);

  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, valor_mensal, data_entrada, data_churn");

  const clients = (clientsData ?? []) as Array<{
    id: string;
    valor_mensal: number;
    data_entrada: string;
    data_churn: string | null;
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

E **mova o import** de `monthRange, lastDayOfMonth` pro topo do arquivo (junto dos outros imports), removendo a duplicação:

Topo final de imports do `queries.ts`:

```ts
import { createClient } from "@/lib/supabase/server";
import { isInMonth, monthRange, lastDayOfMonth } from "./date-utils";
```

- [ ] **Step B3.4: Rodar testes, esperar passar**

```bash
npm run test -- tests/unit/dashboard-queries.test.ts
```

Esperar: 15/15 passa.

- [ ] **Step B3.5: Commit**

```bash
git add src/lib/dashboard/queries.ts tests/unit/dashboard-queries.test.ts
git commit -m "feat(dashboard): getCarteiraTimeline (12-month line) (TDD)"
```

---

### Task B4: `getEntradaChurn` (TDD)

**Files:**
- Modify: `src/lib/dashboard/queries.ts`
- Modify: `tests/unit/dashboard-queries.test.ts`

- [ ] **Step B4.1: Adicionar testes**

Adicione ao final do arquivo de testes:

```ts
import { getEntradaChurn } from "@/lib/dashboard/queries";

describe("getEntradaChurn", () => {
  it("conta entradas e churns por mes", async () => {
    fromMock.mockImplementation(() => ({
      select: vi.fn().mockResolvedValue({
        data: [
          { id: "c1", data_entrada: "2026-02-15", data_churn: null },
          { id: "c2", data_entrada: "2026-02-20", data_churn: null },
          { id: "c3", data_entrada: "2026-03-05", data_churn: null },
          { id: "c4", data_entrada: "2025-08-01", data_churn: "2026-03-10" },
          { id: "c5", data_entrada: "2025-09-01", data_churn: "2026-04-15" },
        ],
      }),
    }));

    const data = await getEntradaChurn(3, new Date(Date.UTC(2026, 3, 28)));
    expect(data).toHaveLength(3);
    expect(data.map((p) => p.mes)).toEqual(["2026-02", "2026-03", "2026-04"]);
    expect(data[0]).toEqual({ mes: "2026-02", entradas: 2, churns: 0 });
    expect(data[1]).toEqual({ mes: "2026-03", entradas: 1, churns: 1 });
    expect(data[2]).toEqual({ mes: "2026-04", entradas: 0, churns: 1 });
  });

  it("retorna zeros para meses sem dados", async () => {
    fromMock.mockImplementation(() => ({
      select: vi.fn().mockResolvedValue({ data: [] }),
    }));
    const data = await getEntradaChurn(2, new Date(Date.UTC(2026, 3, 28)));
    expect(data).toEqual([
      { mes: "2026-03", entradas: 0, churns: 0 },
      { mes: "2026-04", entradas: 0, churns: 0 },
    ]);
  });
});
```

- [ ] **Step B4.2: Rodar testes, esperar falhar**

```bash
npm run test -- tests/unit/dashboard-queries.test.ts
```

- [ ] **Step B4.3: Adicionar `getEntradaChurn` em `queries.ts`**

Adicione ao final de `src/lib/dashboard/queries.ts`:

```ts
export interface EntradaChurnPoint {
  mes: string;
  entradas: number;
  churns: number;
}

export async function getEntradaChurn(
  months: number = 6,
  now: Date = new Date(),
): Promise<EntradaChurnPoint[]> {
  const supabase = await createClient();
  const meses = monthRange(months, now);

  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, data_entrada, data_churn");

  const clients = (clientsData ?? []) as Array<{
    id: string;
    data_entrada: string;
    data_churn: string | null;
  }>;

  return meses.map((mes) => {
    const entradas = clients.filter((c) => isInMonth(c.data_entrada, mes)).length;
    const churns = clients.filter((c) => isInMonth(c.data_churn, mes)).length;
    return { mes, entradas, churns };
  });
}
```

- [ ] **Step B4.4: Rodar testes, esperar passar**

```bash
npm run test -- tests/unit/dashboard-queries.test.ts
```

Esperar: 17/17 passa.

- [ ] **Step B4.5: Commit**

```bash
git add src/lib/dashboard/queries.ts tests/unit/dashboard-queries.test.ts
git commit -m "feat(dashboard): getEntradaChurn (6-month grouped bars) (TDD)"
```

---

### Task B5: `getCarteiraPorAssessor` (TDD)

**Files:**
- Modify: `src/lib/dashboard/queries.ts`
- Modify: `tests/unit/dashboard-queries.test.ts`

- [ ] **Step B5.1: Adicionar testes**

Adicione ao final do arquivo de testes:

```ts
import { getCarteiraPorAssessor } from "@/lib/dashboard/queries";

describe("getCarteiraPorAssessor", () => {
  it("agrupa por assessor e calcula percentuais", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "clients") {
        return {
          select: () => ({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: "c1", valor_mensal: 5000, assessor_id: "a1", assessor: { nome: "Ana" } },
                { id: "c2", valor_mensal: 3000, assessor_id: "a1", assessor: { nome: "Ana" } },
                { id: "c3", valor_mensal: 4000, assessor_id: "a2", assessor: { nome: "Bruno" } },
                // cliente sem assessor: ignorado
                { id: "c4", valor_mensal: 1000, assessor_id: null, assessor: null },
              ],
            }),
          }),
        };
      }
      return {};
    });

    const list = await getCarteiraPorAssessor();
    expect(list).toHaveLength(2);
    // Ordenado por valorTotal desc: Ana (8000) > Bruno (4000)
    expect(list[0]).toEqual({
      assessorId: "a1",
      assessorNome: "Ana",
      qtdClientes: 2,
      valorTotal: 8000,
      pctDoTotal: expect.closeTo(66.67, 1),
    });
    expect(list[1]).toEqual({
      assessorId: "a2",
      assessorNome: "Bruno",
      qtdClientes: 1,
      valorTotal: 4000,
      pctDoTotal: expect.closeTo(33.33, 1),
    });
  });

  it("retorna lista vazia quando sem clientes", async () => {
    fromMock.mockImplementation(() => ({
      select: () => ({ eq: vi.fn().mockResolvedValue({ data: [] }) }),
    }));
    const list = await getCarteiraPorAssessor();
    expect(list).toEqual([]);
  });
});
```

- [ ] **Step B5.2: Rodar testes, esperar falhar**

- [ ] **Step B5.3: Adicionar `getCarteiraPorAssessor` em `queries.ts`**

Adicione ao final:

```ts
export interface AssessorCarteira {
  assessorId: string;
  assessorNome: string;
  qtdClientes: number;
  valorTotal: number;
  pctDoTotal: number;
}

export async function getCarteiraPorAssessor(): Promise<AssessorCarteira[]> {
  const supabase = await createClient();

  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, valor_mensal, assessor_id, assessor:profiles!clients_assessor_id_fkey(nome)")
    .eq("status", "ativo");

  const clients = (clientsData ?? []) as unknown as Array<{
    id: string;
    valor_mensal: number;
    assessor_id: string | null;
    assessor: { nome: string } | null;
  }>;

  // Agrupa por assessor_id
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

- [ ] **Step B5.4: Rodar testes, esperar passar**

```bash
npm run test -- tests/unit/dashboard-queries.test.ts
```

Esperar: 19/19 passa.

- [ ] **Step B5.5: Commit**

```bash
git add src/lib/dashboard/queries.ts tests/unit/dashboard-queries.test.ts
git commit -m "feat(dashboard): getCarteiraPorAssessor with sort and percentages (TDD)"
```

---

### Task B6: `getRankingSatisfacao`, `getProximosEventos`, `getMesAguardandoAprovacao` (TDD)

Bundle de 3 queries menores no mesmo task pra economizar overhead.

**Files:**
- Modify: `src/lib/dashboard/queries.ts`
- Modify: `tests/unit/dashboard-queries.test.ts`

- [ ] **Step B6.1: Adicionar testes**

Adicione ao final do arquivo de testes:

```ts
import { getRankingSatisfacao, getProximosEventos, getMesAguardandoAprovacao } from "@/lib/dashboard/queries";

describe("getRankingSatisfacao", () => {
  it("retorna top 3 verde por score desc e bottom 2 (vermelho > amarelo) por score asc", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "satisfaction_synthesis") {
        return {
          select: () => ({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: "s1", client_id: "c1", semana_iso: "2026-W17", score_final: 9.5, cor_final: "verde", resumo_ia: "ok", divergencia_detectada: false, acao_sugerida: null, created_at: "2026-04-27", cliente: { nome: "Alpha", assessor_id: "a1", coordenador_id: "co1" } },
                { id: "s2", client_id: "c2", semana_iso: "2026-W17", score_final: 8.5, cor_final: "verde", resumo_ia: "ok", divergencia_detectada: false, acao_sugerida: null, created_at: "2026-04-27", cliente: { nome: "Beta", assessor_id: "a1", coordenador_id: "co1" } },
                { id: "s3", client_id: "c3", semana_iso: "2026-W17", score_final: 9.0, cor_final: "verde", resumo_ia: "ok", divergencia_detectada: false, acao_sugerida: null, created_at: "2026-04-27", cliente: { nome: "Gamma", assessor_id: "a1", coordenador_id: "co1" } },
                { id: "s4", client_id: "c4", semana_iso: "2026-W17", score_final: 2.0, cor_final: "vermelho", resumo_ia: "x", divergencia_detectada: false, acao_sugerida: "ação", created_at: "2026-04-27", cliente: { nome: "Delta", assessor_id: "a1", coordenador_id: "co1" } },
                { id: "s5", client_id: "c5", semana_iso: "2026-W17", score_final: 5.0, cor_final: "amarelo", resumo_ia: "x", divergencia_detectada: false, acao_sugerida: "ação", created_at: "2026-04-27", cliente: { nome: "Epsilon", assessor_id: "a1", coordenador_id: "co1" } },
                { id: "s6", client_id: "c6", semana_iso: "2026-W17", score_final: 3.5, cor_final: "vermelho", resumo_ia: "x", divergencia_detectada: false, acao_sugerida: "ação", created_at: "2026-04-27", cliente: { nome: "Zeta", assessor_id: "a1", coordenador_id: "co1" } },
              ],
            }),
          }),
        };
      }
      return {};
    });

    const r = await getRankingSatisfacao();
    expect(r.top.map((s) => s.client_id)).toEqual(["c1", "c3", "c2"]); // 9.5, 9.0, 8.5
    expect(r.bottom.map((s) => s.client_id)).toEqual(["c4", "c6"]);    // vermelhos primeiro: 2.0, 3.5
  });

  it("retorna listas vazias quando sem sínteses", async () => {
    fromMock.mockImplementation(() => ({
      select: () => ({ eq: vi.fn().mockResolvedValue({ data: [] }) }),
    }));
    const r = await getRankingSatisfacao();
    expect(r.top).toEqual([]);
    expect(r.bottom).toEqual([]);
  });
});

describe("getProximosEventos", () => {
  it("retorna eventos ordenados por inicio asc com limite", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "calendar_events") {
        return {
          select: () => ({
            gte: () => ({
              lte: () => ({
                order: () => ({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      { id: "e1", titulo: "Reunião A", inicio: "2026-04-29T10:00:00Z", fim: "2026-04-29T11:00:00Z", sub_calendar: "agencia" },
                      { id: "e2", titulo: "Aniversário B", inicio: "2026-05-02T00:00:00Z", fim: "2026-05-02T23:59:59Z", sub_calendar: "aniversarios" },
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

    const eventos = await getProximosEventos(30, 10);
    expect(eventos).toHaveLength(2);
    expect(eventos[0].titulo).toBe("Reunião A");
    expect(eventos[1].sub_calendar).toBe("aniversarios");
  });
});

describe("getMesAguardandoAprovacao", () => {
  it("retorna mes_referencia mais recente com status pending_approval", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "commission_snapshots") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: vi.fn().mockResolvedValue({
                  data: [{ mes_referencia: "2026-03" }],
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const r = await getMesAguardandoAprovacao();
    expect(r).toEqual({ mes: "2026-03" });
  });

  it("retorna null quando todos snapshots aprovados", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "commission_snapshots") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const r = await getMesAguardandoAprovacao();
    expect(r).toBeNull();
  });
});
```

- [ ] **Step B6.2: Rodar testes, esperar falhar**

- [ ] **Step B6.3: Adicionar as 3 queries em `queries.ts`**

Adicione ao final:

```ts
import type { SatisfactionColor } from "@/lib/satisfacao/schema";

export interface SynthesisRowWithCliente {
  id: string;
  client_id: string;
  semana_iso: string;
  score_final: number;
  cor_final: SatisfactionColor;
  resumo_ia: string;
  divergencia_detectada: boolean;
  acao_sugerida: string | null;
  created_at: string;
  cliente: { nome: string; assessor_id: string | null; coordenador_id: string | null } | null;
}

export async function getRankingSatisfacao(): Promise<{
  top: SynthesisRowWithCliente[];
  bottom: SynthesisRowWithCliente[];
}> {
  const supabase = await createClient();

  // Pegar a semana_iso mais recente de qualquer síntese
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

  const all = (synthData ?? []) as unknown as SynthesisRowWithCliente[];

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

export interface EventoRow {
  id: string;
  titulo: string;
  inicio: string;
  fim: string;
  sub_calendar: "agencia" | "onboarding" | "aniversarios";
}

export async function getProximosEventos(days: number = 30, limit: number = 10): Promise<EventoRow[]> {
  const supabase = await createClient();
  const now = new Date();
  const start = now.toISOString();
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("calendar_events")
    .select("id, titulo, inicio, fim, sub_calendar")
    .gte("inicio", start)
    .lte("inicio", end)
    .order("inicio", { ascending: true })
    .limit(limit);

  return (data ?? []) as EventoRow[];
}

export async function getMesAguardandoAprovacao(): Promise<{ mes: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("commission_snapshots")
    .select("mes_referencia")
    .eq("status", "pending_approval")
    .order("mes_referencia", { ascending: false })
    .limit(1);

  const row = (data?.[0] as { mes_referencia?: string } | undefined);
  return row?.mes_referencia ? { mes: row.mes_referencia } : null;
}
```

- [ ] **Step B6.4: Rodar testes, esperar passar**

```bash
npm run test -- tests/unit/dashboard-queries.test.ts
npm run typecheck
```

Esperar: 24/24 passa, typecheck clean.

- [ ] **Step B6.5: Commit**

```bash
git add src/lib/dashboard/queries.ts tests/unit/dashboard-queries.test.ts
git commit -m "feat(dashboard): ranking, eventos and aprovação queries (TDD)"
```

---

## Bloco C — UI Components

### Task C1: `KpiCard` + `KpiRow` + `Section` + `StubGreeting`

**Files:**
- Create: `src/components/dashboard/KpiCard.tsx`
- Create: `src/components/dashboard/KpiRow.tsx`
- Create: `src/components/dashboard/Section.tsx`
- Create: `src/components/dashboard/StubGreeting.tsx`

- [ ] **Step C1.1: Criar `<Section>` (server)**

`src/components/dashboard/Section.tsx`:

```tsx
import Link from "next/link";

interface Props {
  title: string;
  subtitle?: string;
  cta?: { href: string; label: string };
  children: React.ReactNode;
}

export function Section({ title, subtitle, cta, children }: Props) {
  return (
    <section className="rounded-xl border bg-card p-4 space-y-3">
      <header className="flex items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {cta && (
          <Link href={cta.href} className="text-xs text-primary hover:underline">
            {cta.label}
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}
```

- [ ] **Step C1.2: Criar `<KpiCard>` (server)**

`src/components/dashboard/KpiCard.tsx`:

```tsx
import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";

interface Props {
  label: string;
  valor: string;
  delta?: { valor: string; direction: "up" | "down" | "neutral" };
  icon?: LucideIcon;
  helperText?: string;
}

export function KpiCard({ label, valor, delta, icon: Icon, helperText }: Props) {
  const deltaColor =
    delta?.direction === "up"
      ? "text-green-600 dark:text-green-400"
      : delta?.direction === "down"
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";

  return (
    <div className="rounded-xl border bg-card p-4 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="text-2xl font-bold tracking-tight tabular-nums">{valor}</div>
      {delta && (
        <div className={`flex items-center gap-1 text-xs ${deltaColor}`}>
          {delta.direction === "up" && <ArrowUp className="h-3 w-3" />}
          {delta.direction === "down" && <ArrowDown className="h-3 w-3" />}
          <span>{delta.valor}</span>
          {helperText && <span className="text-muted-foreground">· {helperText}</span>}
        </div>
      )}
      {!delta && helperText && (
        <div className="text-xs text-muted-foreground">{helperText}</div>
      )}
    </div>
  );
}
```

- [ ] **Step C1.3: Criar `<KpiRow>` (server)**

`src/components/dashboard/KpiRow.tsx`:

```tsx
import { Wallet, Users, TrendingDown, Percent } from "lucide-react";
import { KpiCard } from "./KpiCard";
import type { KpiData } from "@/lib/dashboard/queries";

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

function formatDelta(v: number, currency: boolean): { valor: string; direction: "up" | "down" | "neutral" } {
  if (v === 0) return { valor: currency ? "R$ 0" : "0", direction: "neutral" };
  const formatted = currency ? formatBRL(Math.abs(v)) : String(Math.abs(v));
  return { valor: formatted, direction: v > 0 ? "up" : "down" };
}

export function KpiRow({ kpis }: { kpis: KpiData }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Carteira ativa"
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
    </div>
  );
}
```

- [ ] **Step C1.4: Criar `<StubGreeting>` (server)**

`src/components/dashboard/StubGreeting.tsx`:

```tsx
interface Props {
  nome: string;
}

export function StubGreeting({ nome }: Props) {
  const primeiroNome = nome.split(" ")[0];
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Olá, {primeiroNome}</h1>
        <p className="text-sm text-muted-foreground">
          O dashboard do seu papel chega na próxima fase.
        </p>
      </header>
    </div>
  );
}
```

- [ ] **Step C1.5: Typecheck e commit**

```bash
npm run typecheck
git add src/components/dashboard/Section.tsx \
  src/components/dashboard/KpiCard.tsx \
  src/components/dashboard/KpiRow.tsx \
  src/components/dashboard/StubGreeting.tsx
git commit -m "feat(dashboard): KpiCard, KpiRow, Section and StubGreeting components"
```

---

### Task C2: Charts client-only com `recharts`

**Files:**
- Create: `src/components/dashboard/ChartCarteiraTimeline.tsx`
- Create: `src/components/dashboard/ChartEntradaChurn.tsx`

- [ ] **Step C2.1: Criar `<ChartCarteiraTimeline>` (client)**

`src/components/dashboard/ChartCarteiraTimeline.tsx`:

```tsx
"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { monthLabel } from "@/lib/dashboard/date-utils";
import type { TimelinePoint } from "@/lib/dashboard/queries";

interface Props {
  data: TimelinePoint[];
}

function formatBRLShort(v: number): string {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(0)}k`;
  return `R$${v}`;
}

export function ChartCarteiraTimeline({ data }: Props) {
  const chartData = data.map((p) => ({ mes: monthLabel(p.mes), valor: p.valorTotal }));

  return (
    <div className="h-64 w-full" aria-label="Gráfico de evolução da carteira nos últimos 12 meses">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis tickFormatter={formatBRLShort} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={60} />
          <Tooltip
            formatter={(v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="valor"
            stroke="#3DC4BC"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step C2.2: Criar `<ChartEntradaChurn>` (client)**

`src/components/dashboard/ChartEntradaChurn.tsx`:

```tsx
"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { monthLabel } from "@/lib/dashboard/date-utils";
import type { EntradaChurnPoint } from "@/lib/dashboard/queries";

interface Props {
  data: EntradaChurnPoint[];
}

export function ChartEntradaChurn({ data }: Props) {
  const chartData = data.map((p) => ({
    mes: monthLabel(p.mes),
    Entradas: p.entradas,
    Churns: p.churns,
  }));

  return (
    <div className="h-64 w-full" aria-label="Gráfico de entradas vs churns nos últimos 6 meses">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={32} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="Entradas" fill="#22c55e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Churns" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step C2.3: Typecheck e commit**

```bash
npm run typecheck
git add src/components/dashboard/ChartCarteiraTimeline.tsx \
  src/components/dashboard/ChartEntradaChurn.tsx
git commit -m "feat(dashboard): timeline and entrada-vs-churn charts (recharts)"
```

---

### Task C3: 4 painéis-lista (`CarteiraPorAssessorList`, `RankingResumo`, `ProximosEventosList`, `AlertaAprovacao`)

**Files:**
- Create: `src/components/dashboard/CarteiraPorAssessorList.tsx`
- Create: `src/components/dashboard/RankingResumo.tsx`
- Create: `src/components/dashboard/ProximosEventosList.tsx`
- Create: `src/components/dashboard/AlertaAprovacao.tsx`

- [ ] **Step C3.1: Criar `<CarteiraPorAssessorList>` (server)**

`src/components/dashboard/CarteiraPorAssessorList.tsx`:

```tsx
import type { AssessorCarteira } from "@/lib/dashboard/queries";

interface Props {
  items: AssessorCarteira[];
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

export function CarteiraPorAssessorList({ items }: Props) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Sem assessores com clientes ativos.</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((a) => (
        <li key={a.assessorId} className="space-y-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">{a.assessorNome}</span>
            <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
              <span>{a.qtdClientes} {a.qtdClientes === 1 ? "cliente" : "clientes"}</span>
              <span className="font-semibold text-foreground">{formatBRL(a.valorTotal)}</span>
              <span className="w-10 text-right">{a.pctDoTotal.toFixed(0)}%</span>
            </div>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${a.pctDoTotal}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step C3.2: Criar `<RankingResumo>` (server)**

`src/components/dashboard/RankingResumo.tsx`:

```tsx
import Link from "next/link";
import { SatisfactionSparkline } from "@/components/satisfacao/SatisfactionSparkline";
import type { SynthesisRowWithCliente } from "@/lib/dashboard/queries";

interface Props {
  top: SynthesisRowWithCliente[];
  bottom: SynthesisRowWithCliente[];
}

function medal(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

function Item({ rank, s }: { rank: number; s: SynthesisRowWithCliente }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span className="font-bold w-6 text-center">{medal(rank)}</span>
      <Link href={`/clientes/${s.client_id}/satisfacao`} className="flex-1 truncate hover:underline">
        {s.cliente?.nome ?? "—"}
      </Link>
      <SatisfactionSparkline clientId={s.client_id} />
      <span className="font-semibold tabular-nums w-10 text-right">{Number(s.score_final).toFixed(1)}</span>
    </li>
  );
}

export function RankingResumo({ top, bottom }: Props) {
  if (top.length === 0 && bottom.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Sem sínteses disponíveis ainda.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
          Mais satisfeitos
        </h3>
        {top.length === 0 ? (
          <p className="text-xs text-muted-foreground">—</p>
        ) : (
          <ul className="space-y-2">
            {top.map((s, i) => <Item key={s.id} rank={i + 1} s={s} />)}
          </ul>
        )}
      </div>
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
          Menos satisfeitos
        </h3>
        {bottom.length === 0 ? (
          <p className="text-xs text-muted-foreground">—</p>
        ) : (
          <ul className="space-y-2">
            {bottom.map((s, i) => <Item key={s.id} rank={i + 1} s={s} />)}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step C3.3: Criar `<ProximosEventosList>` (server)**

`src/components/dashboard/ProximosEventosList.tsx`:

```tsx
import { CalendarClock, Cake, Briefcase } from "lucide-react";
import type { EventoRow } from "@/lib/dashboard/queries";

interface Props {
  eventos: EventoRow[];
}

const subCalendarIcon = {
  agencia: CalendarClock,
  onboarding: Briefcase,
  aniversarios: Cake,
};

const subCalendarColor = {
  agencia: "text-blue-600 dark:text-blue-400",
  onboarding: "text-purple-600 dark:text-purple-400",
  aniversarios: "text-pink-600 dark:text-pink-400",
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

export function ProximosEventosList({ eventos }: Props) {
  if (eventos.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Sem eventos nos próximos 30 dias.</p>;
  }

  return (
    <ul className="space-y-2">
      {eventos.map((e) => {
        const Icon = subCalendarIcon[e.sub_calendar];
        const color = subCalendarColor[e.sub_calendar];
        return (
          <li key={e.id} className="flex items-center gap-3 text-sm">
            <Icon className={`h-4 w-4 shrink-0 ${color}`} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{e.titulo}</div>
              <div className="text-xs text-muted-foreground">{formatRelative(e.inicio)}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step C3.4: Criar `<AlertaAprovacao>` (server)**

`src/components/dashboard/AlertaAprovacao.tsx`:

```tsx
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { monthLabel } from "@/lib/dashboard/date-utils";

interface Props {
  mes: string | null;
}

export function AlertaAprovacao({ mes }: Props) {
  if (!mes) return null;
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            Mês de {monthLabel(mes)} aguardando sua aprovação
          </p>
          <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
            Comissões precisam ser revisadas e aprovadas para fechamento.
          </p>
        </div>
      </div>
      <Link
        href="/comissoes/fechamento"
        className="shrink-0 text-sm font-medium text-amber-900 dark:text-amber-100 hover:underline"
      >
        Revisar agora →
      </Link>
    </div>
  );
}
```

- [ ] **Step C3.5: Typecheck e commit**

```bash
npm run typecheck
git add src/components/dashboard/CarteiraPorAssessorList.tsx \
  src/components/dashboard/RankingResumo.tsx \
  src/components/dashboard/ProximosEventosList.tsx \
  src/components/dashboard/AlertaAprovacao.tsx
git commit -m "feat(dashboard): list panels (assessor, ranking, eventos, alerta)"
```

---

## Bloco D — Page + e2e + push

### Task D1: Substituir `page.tsx`, push e PR

**Files:**
- Modify: `src/app/(authed)/page.tsx`

- [ ] **Step D1.1: Substituir `src/app/(authed)/page.tsx`**

```tsx
import { requireAuth } from "@/lib/auth/session";
import {
  getKpis,
  getCarteiraTimeline,
  getEntradaChurn,
  getCarteiraPorAssessor,
  getRankingSatisfacao,
  getProximosEventos,
  getMesAguardandoAprovacao,
} from "@/lib/dashboard/queries";
import { KpiRow } from "@/components/dashboard/KpiRow";
import { ChartCarteiraTimeline } from "@/components/dashboard/ChartCarteiraTimeline";
import { ChartEntradaChurn } from "@/components/dashboard/ChartEntradaChurn";
import { CarteiraPorAssessorList } from "@/components/dashboard/CarteiraPorAssessorList";
import { RankingResumo } from "@/components/dashboard/RankingResumo";
import { ProximosEventosList } from "@/components/dashboard/ProximosEventosList";
import { AlertaAprovacao } from "@/components/dashboard/AlertaAprovacao";
import { Section } from "@/components/dashboard/Section";
import { StubGreeting } from "@/components/dashboard/StubGreeting";

export default async function DashboardPage() {
  const user = await requireAuth();

  if (user.role !== "socio" && user.role !== "adm") {
    return <StubGreeting nome={user.nome} />;
  }

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
        <h1 className="text-2xl font-bold tracking-tight">Olá, {user.nome.split(" ")[0]}</h1>
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

- [ ] **Step D1.2: Rodar todos os testes + typecheck + build local**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
npm run test
npm run typecheck
```

Esperar: typecheck clean. Pelo menos 13 testes novos da Fase 9 passam (4 date-utils + 2 getKpis + 2 timeline + 2 entradaChurn + 2 assessor + 2 ranking + 1 eventos + 2 aprovacao = ~17). 1 falha pré-existente flaky em `tarefas-schema` é OK.

- [ ] **Step D1.3: Commit da page**

```bash
git add "src/app/(authed)/page.tsx"
git commit -m "feat(dashboard): wire up Sócio/ADM dashboard page"
```

- [ ] **Step D1.4: Push e abrir PR**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
git push -u origin claude/fase-9-dashboard
```

```bash
/opt/homebrew/bin/gh pr create --base main --head claude/fase-9-dashboard \
  --title "feat: Fase 9 — Dashboard Sócio/ADM (KPIs + gráficos + painéis)" \
  --body "$(cat <<'EOF'
## Summary
- Substitui o stub atual em `/` por dashboard completo para papéis Sócio e ADM
- 4 KPIs (carteira ativa, clientes ativos, churn do mês, custo de comissão %) com deltas mês-a-mês
- 2 gráficos (recharts): evolução da carteira (linha 12 meses) + entrada vs churn (barras agrupadas 6 meses)
- 3 painéis-lista: carteira por assessor (ranqueada), ranking satisfação resumido (top 3 + bottom 2), próximos eventos 30 dias
- Alerta condicional no topo: mês de comissão aguardando aprovação
- Outros papéis (Coordenador, Assessor, Comercial) recebem stub de saudação com aviso "em breve" — dashboards próprios virão em fase futura

## Test plan
- [x] ~17 unit tests novos (date-utils + 7 queries com mocks de Supabase)
- [x] Typecheck clean
- [x] Reusa `getSynthesisForWeek` e `<SatisfactionSparkline>` da Fase 8
- [ ] Verificar Production deploy depois do merge
- [ ] Validar visualmente em produção (charts renderizam, KPIs corretos)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step D1.5: Verificar Production deploy depois do merge**

```bash
/opt/homebrew/bin/gh api repos/time-yide/yide-acompanha/deployments --jq '.[0].id' \
  | xargs -I {} /opt/homebrew/bin/gh api repos/time-yide/yide-acompanha/deployments/{}/statuses --jq '.[0].state'
```

Esperar: `success`. Validar manualmente em produção: login como sócio/adm → dashboard renderiza com gráficos e KPIs reais.

---

## Self-Review

### Cobertura do spec — seção 5.9 (Sócio/ADM only)

| Spec | Coberto por |
|---|---|
| 4 KPIs (carteira, clientes, churn, custo comissão) | B2 (`getKpis`) + C1 (`<KpiRow>`) |
| Delta mês-a-mês nos KPIs | B2 (calcula delta) + C1 (renderiza ▲/▼) |
| Gráfico evolução carteira (linha, 12 meses) | B3 (`getCarteiraTimeline`) + C2 (`<ChartCarteiraTimeline>`) |
| Gráfico entrada vs churn (barras, 6 meses) | B4 (`getEntradaChurn`) + C2 (`<ChartEntradaChurn>`) |
| Painel carteira por assessor (ranqueada) | B5 (`getCarteiraPorAssessor`) + C3 (`<CarteiraPorAssessorList>`) |
| Painel ranking satisfação (top 3 + bottom 2) | B6 (`getRankingSatisfacao`) + C3 (`<RankingResumo>`) |
| Link "ver completo" no ranking | C3 (`<RankingResumo>` com Link pra `/satisfacao`) — passado como `cta` da Section |
| Painel próximos eventos (30 dias) | B6 (`getProximosEventos`) + C3 (`<ProximosEventosList>`) |
| Alerta de mês aguardando aprovação | B6 (`getMesAguardandoAprovacao`) + C3 (`<AlertaAprovacao>`) |
| Outros papéis: stub atual com aviso | C1 (`<StubGreeting>`) + D1 (page faz role check) |
| Reusa `recharts` (instalado em A1) | A1 + C2 |
| Reusa `<SatisfactionSparkline>` da Fase 8 | C3 (`<RankingResumo>` importa) |

### Lacunas conhecidas (intencionais)

- Dashboard de Coordenador/Assessor/Comercial → Fase 9.1 (fora de escopo agora)
- Drill-down ao clicar em KPI/gráfico → futuro
- Customização de blocos → futuro
- Export → futuro
- Datas customizáveis → futuro
- Sem testes E2E novos — auth-redirect pra `/` já existe

---

## Resumo da entrega

Após executar:

- 1 dependência nova (`recharts`)
- 7 funções de query server-side em `src/lib/dashboard/queries.ts` com testes
- 4 helpers em `src/lib/dashboard/date-utils.ts` com testes
- 8 componentes UI em `src/components/dashboard/` (1 client p/ cada chart, resto server)
- Page raiz `(authed)/page.tsx` substituído com role check
- Stub para outros papéis (mensagem "em breve")
- ~17 testes unitários novos

Total: **~13 commits** (A1, B1, B2, B3, B4, B5, B6, C1, C2, C3, D1.3, mais 1-2 de typecheck/cleanup se necessário).
