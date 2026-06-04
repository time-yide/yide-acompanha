# Seletor de mês no dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir, nos dashboards de assessor/coordenador/comercial, escolher um mês passado (dropdown 12 meses) e ver "como o mês fechou": KPIs reconstruídos, comissão do snapshot real, gráficos terminando no mês.

**Architecture:** Um param de URL `?mes=YYYY-MM` validado na página é passado como prop pros 3 dashboards. As queries sensíveis ganham um parâmetro opcional de mês e reconstroem o passado reusando helpers que já existem (`isActiveOn`, `monthRange`, `lastDayOfMonth`). A comissão de meses fechados vem da tabela `commission_snapshots`. Cards "pra frente" são escondidos em mês passado.

**Tech Stack:** Next.js (App Router, RSC), TypeScript, Supabase (service-role), Vitest. Spec: `docs/superpowers/specs/2026-06-04-dashboard-seletor-mes-design.md`.

**Convenções do repo:**
- Datas/mês: helpers em `src/lib/dashboard/date-utils.ts` (`monthRange`, `monthLabel`, `lastDayOfMonth`, `isInMonth`) e `src/lib/datetime/timezone.ts` (`getCurrentMonthYM`).
- Testes: Vitest, mock de `@/lib/supabase/service-role`. Rodar SEMPRE com `--exclude '**/.claude/**'` (worktrees poluem o glob).
- Commits frequentes, um por task.

---

## Fase 1 — Plumbing do mês (sem mudar números ainda)

Entrega: dropdown de mês aparece nos 3 dashboards e muda `?mes=`, mas as queries ainda ignoram o mês (tudo continua mostrando o atual). Base segura.

### Task 1.1: Helpers de mês (`mesesRecentes`, `parseMes`, `previousMonthYM`)

**Files:**
- Modify: `src/lib/dashboard/date-utils.ts` (append no fim)
- Test: `tests/unit/dashboard-mes-utils.test.ts` (criar)

- [ ] **Step 1: Escrever o teste que falha**

```ts
// tests/unit/dashboard-mes-utils.test.ts
import { describe, it, expect } from "vitest";
import { mesesRecentes, parseMes, previousMonthYM } from "@/lib/dashboard/date-utils";

const HOJE = new Date(Date.UTC(2026, 5, 4)); // 2026-06-04

describe("mesesRecentes", () => {
  it("retorna 12 meses, atual primeiro, descendente", () => {
    const r = mesesRecentes(12, HOJE);
    expect(r.length).toBe(12);
    expect(r[0]).toBe("2026-06");
    expect(r[1]).toBe("2026-05");
    expect(r[11]).toBe("2025-07");
  });
});

describe("parseMes", () => {
  it("aceita um mês dentro dos últimos 12", () => {
    expect(parseMes("2026-05", HOJE)).toBe("2026-05");
  });
  it("rejeita mês futuro -> cai no atual", () => {
    expect(parseMes("2026-07", HOJE)).toBe("2026-06");
  });
  it("rejeita mês antigo demais -> cai no atual", () => {
    expect(parseMes("2024-01", HOJE)).toBe("2026-06");
  });
  it("rejeita formato inválido/undefined -> cai no atual", () => {
    expect(parseMes("xx", HOJE)).toBe("2026-06");
    expect(parseMes(undefined, HOJE)).toBe("2026-06");
  });
});

describe("previousMonthYM", () => {
  it("vira o ano corretamente", () => {
    expect(previousMonthYM("2026-01")).toBe("2025-12");
    expect(previousMonthYM("2026-06")).toBe("2026-05");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run --exclude '**/.claude/**' tests/unit/dashboard-mes-utils.test.ts`
Expected: FAIL — "mesesRecentes is not a function".

- [ ] **Step 3: Implementar os helpers**

Adicionar ao FIM de `src/lib/dashboard/date-utils.ts`:

```ts
/** Últimos `count` meses 'YYYY-MM', do mais recente pro mais antigo. */
export function mesesRecentes(count: number, from: Date = new Date()): string[] {
  return monthRange(count, from).slice().reverse();
}

/** Mês anterior a um 'YYYY-MM'. */
export function previousMonthYM(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Valida `?mes=`: precisa estar nos últimos 12 meses (inclui atual), senão cai no atual. */
export function parseMes(raw: string | undefined, from: Date = new Date()): string {
  const validos = new Set(mesesRecentes(12, from));
  if (raw && /^\d{4}-\d{2}$/.test(raw) && validos.has(raw)) return raw;
  return mesesRecentes(1, from)[0];
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run --exclude '**/.claude/**' tests/unit/dashboard-mes-utils.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboard/date-utils.ts tests/unit/dashboard-mes-utils.test.ts
git commit -m "feat(dashboard): helpers de mês (mesesRecentes/parseMes/previousMonthYM)"
```

### Task 1.2: Componente `MesSelector`

**Files:**
- Create: `src/components/dashboard/MesSelector.tsx`

> Componente cliente, espelha o padrão do `ImpersonateBar` (muda searchParam preservando os outros). Sem teste unitário (UI trivial; coberto manualmente).

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/dashboard/MesSelector.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { monthLabel } from "@/lib/dashboard/date-utils";

interface Props {
  /** 'YYYY-MM' selecionado. */
  mes: string;
  /** Lista de 'YYYY-MM' (atual primeiro). */
  meses: string[];
  /** 'YYYY-MM' do mês corrente, pra marcar o selo de histórico. */
  mesAtual: string;
}

export function MesSelector({ mes, meses, mesAtual }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  function onChange(value: string) {
    const sp = new URLSearchParams(params.toString());
    if (value && value !== mesAtual) sp.set("mes", value);
    else sp.delete("mes");
    const qs = sp.toString();
    router.push(qs ? `?${qs}` : "?");
  }

  const histórico = mes !== mesAtual;

  return (
    <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
      {histórico && (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-300">
          Fechado · histórico
        </span>
      )}
      <span>Mês:</span>
      <select
        value={mes}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 rounded-md border bg-card px-2 text-xs"
      >
        {meses.map((m) => (
          <option key={m} value={m}>
            {monthLabel(m)}
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "MesSelector|date-utils" || echo OK`
Expected: `OK` (sem erros nesses arquivos).

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/MesSelector.tsx
git commit -m "feat(dashboard): componente MesSelector (dropdown 12 meses)"
```

### Task 1.3: Página passa `mes`/`isMesAtual` pros 3 dashboards

**Files:**
- Modify: `src/app/(authed)/page.tsx`
- Modify: `src/components/dashboard/DashboardAssessor.tsx` (assinatura Props + render do seletor)
- Modify: `src/components/dashboard/DashboardCoord.tsx` (idem)
- Modify: `src/components/dashboard/DashboardComercial.tsx` (idem)

> Nesta fase os dashboards SÓ recebem e renderizam o seletor. As queries ainda não usam o mês (próximas fases).

- [ ] **Step 1: page.tsx — parsear `mes` e repassar**

Em `src/app/(authed)/page.tsx`:

1. No topo, adicionar import:
```ts
import { parseMes, mesesRecentes } from "@/lib/dashboard/date-utils";
import { getCurrentMonthYM } from "@/lib/datetime/timezone";
```

2. Ampliar o tipo do `searchParams` (linha ~63) pra incluir `mes`:
```ts
searchParams: Promise<{ as?: string; periodo?: string; mes?: string }>;
```

3. Após `const periodo = parsePeriodo(params.periodo);` adicionar:
```ts
const mes = parseMes(params.mes);
const mesAtual = getCurrentMonthYM(new Date());
const meses = mesesRecentes(12, new Date());
```

4. Trocar a assinatura de `renderDashboardForRole` pra receber esses valores e repassar aos 3 dashboards:
```ts
function renderDashboardForRole(
  target: TargetUser,
  periodo: Periodo,
  mesCtx: { mes: string; mesAtual: string; meses: string[] },
) {
  // ...
  if (target.role === "coordenador") {
    return <DashboardCoord userId={target.id} nome={target.nome} {...mesCtx} />;
  }
  if (target.role === "assessor") {
    return <DashboardAssessor userId={target.id} nome={target.nome} {...mesCtx} />;
  }
  if (target.role === "comercial") {
    return <DashboardComercial userId={target.id} nome={target.nome} {...mesCtx} />;
  }
  // ...demais roles inalterados...
}
```

5. Na chamada (linha ~106), passar o contexto:
```ts
{renderDashboardForRole(target, periodo, { mes, mesAtual, meses })}
```

- [ ] **Step 2: DashboardAssessor — Props + seletor no header**

Em `src/components/dashboard/DashboardAssessor.tsx`:

1. Import:
```ts
import { MesSelector } from "./MesSelector";
```
2. Props:
```ts
interface Props {
  userId: string;
  nome: string;
  mes: string;
  mesAtual: string;
  meses: string[];
}
export async function DashboardAssessor({ userId, nome, mes, mesAtual, meses }: Props) {
```
3. No `<header>`, ao lado do `<HiddenValueToggle />`, envolver num flex e adicionar o seletor:
```tsx
<div className="flex flex-col items-end gap-2">
  <MesSelector mes={mes} meses={meses} mesAtual={mesAtual} />
  <HiddenValueToggle />
</div>
```

- [ ] **Step 3: DashboardCoord e DashboardComercial — mesmo tratamento**

Repetir EXATAMENTE o Step 2 (import `MesSelector`, Props com `mes/mesAtual/meses`, seletor no header) em:
- `src/components/dashboard/DashboardCoord.tsx`
- `src/components/dashboard/DashboardComercial.tsx`

- [ ] **Step 4: Typecheck + build mental**

Run: `npx tsc --noEmit 2>&1 | grep -E "Dashboard(Assessor|Coord|Comercial)|page.tsx" || echo OK`
Expected: `OK`.

- [ ] **Step 5: Commit**

```bash
git add src/app/"(authed)"/page.tsx src/components/dashboard/DashboardAssessor.tsx src/components/dashboard/DashboardCoord.tsx src/components/dashboard/DashboardComercial.tsx
git commit -m "feat(dashboard): seletor de mês renderizado nos 3 dashboards (sem efeito ainda)"
```

---

## Fase 2 — Comissão por mês (snapshot pra meses fechados)

Entrega: o card de remuneração reflete o mês escolhido (snapshot real "fechado" pra meses passados, preview "em curso" pro atual).

### Task 2.1: Leitor de snapshot por usuário+mês

**Files:**
- Modify: `src/lib/comissoes/queries.ts` (adicionar função)
- Test: `tests/unit/comissoes-snapshot-mes.test.ts` (criar)

- [ ] **Step 1: Teste que falha**

```ts
// tests/unit/comissoes-snapshot-mes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

import { getSnapshotForUserMonth } from "@/lib/comissoes/queries";

beforeEach(() => fromMock.mockReset());

it("retorna o snapshot do user no mês, ou null", async () => {
  fromMock.mockImplementation(() => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { user_id: "u1", mes_referencia: "2026-05", fixo: 3000, percentual_aplicado: 5, base_calculo: 5500, valor_variavel: 275, valor_total: 3275, status: "aprovado" },
            error: null,
          }),
        }),
      }),
    }),
  }));
  const r = await getSnapshotForUserMonth("u1", "2026-05");
  expect(r?.valor_total).toBe(3275);
  expect(r?.percentual_aplicado).toBe(5);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run --exclude '**/.claude/**' tests/unit/comissoes-snapshot-mes.test.ts`
Expected: FAIL — "getSnapshotForUserMonth is not a function".

- [ ] **Step 3: Implementar (append em `src/lib/comissoes/queries.ts`)**

```ts
/** Snapshot de comissão de um usuário num mês específico (ou null). Service-role. */
export async function getSnapshotForUserMonth(userId: string, monthRef: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("commission_snapshots")
    .select("*")
    .eq("user_id", userId)
    .eq("mes_referencia", monthRef)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run --exclude '**/.claude/**' tests/unit/comissoes-snapshot-mes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/comissoes/queries.ts tests/unit/comissoes-snapshot-mes.test.ts
git commit -m "feat(comissoes): getSnapshotForUserMonth (snapshot por user+mês)"
```

### Task 2.2: `getComissaoDoMes` — escolhe snapshot vs preview

**Files:**
- Modify: `src/lib/dashboard/comissao-prevista.ts` (adicionar tipo + função; manter `getComissaoPrevista` como está)
- Test: `tests/unit/dashboard-comissao-do-mes.test.ts` (criar)

- [ ] **Step 1: Teste que falha**

```ts
// tests/unit/dashboard-comissao-do-mes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getComissaoPrevistaMock = vi.hoisted(() => vi.fn());
const getSnapshotForUserMonthMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/comissoes/queries", () => ({
  getSnapshotForUserMonth: getSnapshotForUserMonthMock,
}));

// getComissaoPrevista vive no MESMO módulo; testamos getComissaoDoMes
// stubando a leitura de snapshot e a query via service-role.
const fromMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

import { getComissaoDoMes } from "@/lib/dashboard/comissao-prevista";

beforeEach(() => {
  getComissaoPrevistaMock.mockReset();
  getSnapshotForUserMonthMock.mockReset();
  fromMock.mockReset();
});

it("mês fechado COM snapshot -> usa o snapshot, status 'fechado'", async () => {
  getSnapshotForUserMonthMock.mockResolvedValue({
    fixo: 3000, percentual_aplicado: 5, base_calculo: 5500, valor_variavel: 275, valor_total: 3275,
  });
  const r = await getComissaoDoMes("u1", "assessor", "2026-05", false);
  expect(r.status).toBe("fechado");
  expect(r.valor).toBe(3275);
  expect(r.valorVariavel).toBe(275);
  expect(r.baseCalculo).toBe(5500);
  expect(r.percentual).toBe(5);
});

it("mês fechado SEM snapshot -> recálculo, status 'estimado'", async () => {
  getSnapshotForUserMonthMock.mockResolvedValue(null);
  // profiles + clients vazios -> recálculo devolve zeros + fixo
  fromMock.mockImplementation((table: string) => {
    if (table === "profiles") {
      return { select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({ data: { fixo_mensal: 1000, comissao_percent: 5, comissao_primeiro_mes_percent: 0 } }) }) }) };
    }
    if (table === "clients") {
      const chain: any = { eq: vi.fn(), is: vi.fn(), then: (r: any) => Promise.resolve({ data: [] }).then(r) };
      chain.eq.mockReturnValue(chain); chain.is.mockReturnValue(chain);
      return { select: () => chain };
    }
    if (table === "client_monthly_adjustments") {
      return { select: () => ({ in: () => ({ eq: vi.fn().mockResolvedValue({ data: [] }) }) }) };
    }
    return {};
  });
  const r = await getComissaoDoMes("u1", "assessor", "2026-05", false);
  expect(r.status).toBe("estimado");
  expect(r.valor).toBe(1000);
});

it("mês atual -> preview ao vivo, status 'em_curso'", async () => {
  fromMock.mockImplementation((table: string) => {
    if (table === "profiles") {
      return { select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({ data: { fixo_mensal: 2000, comissao_percent: 5, comissao_primeiro_mes_percent: 0 } }) }) }) };
    }
    if (table === "clients") {
      const chain: any = { eq: vi.fn(), is: vi.fn(), then: (r: any) => Promise.resolve({ data: [] }).then(r) };
      chain.eq.mockReturnValue(chain); chain.is.mockReturnValue(chain);
      return { select: () => chain };
    }
    if (table === "client_monthly_adjustments") {
      return { select: () => ({ in: () => ({ eq: vi.fn().mockResolvedValue({ data: [] }) }) }) };
    }
    return {};
  });
  const r = await getComissaoDoMes("u1", "assessor", "2026-06", true);
  expect(r.status).toBe("em_curso");
  expect(r.valor).toBe(2000);
  expect(getSnapshotForUserMonthMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run --exclude '**/.claude/**' tests/unit/dashboard-comissao-do-mes.test.ts`
Expected: FAIL — "getComissaoDoMes is not a function".

- [ ] **Step 3: Implementar (em `src/lib/dashboard/comissao-prevista.ts`)**

Adicionar import no topo:
```ts
import { getSnapshotForUserMonth } from "@/lib/comissoes/queries";
import { lastDayOfMonth } from "./date-utils";
```

Adicionar tipo + função (no fim do arquivo):
```ts
export type StatusComissao = "em_curso" | "fechado" | "estimado";

export interface ComissaoDoMes extends ComissaoPrevista {
  status: StatusComissao;
}

/**
 * Comissão pra um mês qualquer no dashboard.
 * - Mês atual: preview ao vivo (em_curso).
 * - Mês fechado com snapshot: valor real do snapshot (fechado).
 * - Mês fechado sem snapshot: recálculo ao vivo daquele mês (estimado).
 */
export async function getComissaoDoMes(
  userId: string,
  role: Role,
  mes: string,
  isMesAtual: boolean,
): Promise<ComissaoDoMes> {
  if (isMesAtual) {
    const c = await getComissaoPrevista(userId, role);
    return { ...c, status: "em_curso" };
  }

  const snap = await getSnapshotForUserMonth(userId, mes);
  if (snap) {
    return {
      valor: Number(snap.valor_total),
      valorVariavel: Number(snap.valor_variavel),
      baseCalculo: Number(snap.base_calculo),
      fixo: Number(snap.fixo),
      percentual: Number(snap.percentual_aplicado),
      status: "fechado",
    };
  }

  const dataNoMes = new Date(`${lastDayOfMonth(mes)}T12:00:00Z`);
  const c = await getComissaoPrevista(userId, role, dataNoMes);
  return { ...c, status: "estimado" };
}
```

> Nota: `getComissaoPrevista` já aceita `now` como 3º arg e calcula o mês a partir dele (`getCurrentMonthYM(now)`), então o recálculo do mês fechado funciona.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run --exclude '**/.claude/**' tests/unit/dashboard-comissao-do-mes.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboard/comissao-prevista.ts tests/unit/dashboard-comissao-do-mes.test.ts
git commit -m "feat(dashboard): getComissaoDoMes (snapshot fechado vs preview/estimado)"
```

### Task 2.3: `RemuneracaoCard` com rótulo dinâmico + wiring nos 3 dashboards

**Files:**
- Modify: `src/components/dashboard/RemuneracaoCard.tsx`
- Modify: `DashboardAssessor.tsx`, `DashboardCoord.tsx`, `DashboardComercial.tsx`

- [ ] **Step 1: RemuneracaoCard aceita `status`**

Em `src/components/dashboard/RemuneracaoCard.tsx`:

1. Trocar a assinatura e o badge:
```tsx
import type { ComissaoDoMes } from "@/lib/dashboard/comissao-prevista";

const BADGE: Record<ComissaoDoMes["status"], { txt: string; live: boolean }> = {
  em_curso: { txt: "Em curso · não fechado ainda", live: true },
  fechado: { txt: "Fechado", live: false },
  estimado: { txt: "Estimado (sem snapshot)", live: false },
};

export function RemuneracaoCard({ comissao }: { comissao: ComissaoDoMes }) {
  const temBase = comissao.baseCalculo > 0;
  const badge = BADGE[comissao.status];
```
2. No JSX do selo (o `<span>` com "Em curso · não fechado ainda"), trocar o texto fixo por `{badge.txt}` e condicionar o ponto pulsante a `badge.live`:
```tsx
<span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-600 dark:text-sky-400">
  {badge.live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />}
  {badge.txt}
</span>
```
3. O label embaixo do total ("pode variar até o fechamento") só faz sentido em curso:
```tsx
<div className="text-[11px] text-muted-foreground">
  {comissao.status === "em_curso" ? "pode variar até o fechamento" : "valor do mês"}
</div>
```

- [ ] **Step 2: Trocar `getComissaoPrevista` por `getComissaoDoMes` nos 3 dashboards**

Em cada um (`DashboardAssessor`, `DashboardCoord`, `DashboardComercial`):
1. Import:
```ts
import { getComissaoDoMes } from "@/lib/dashboard/comissao-prevista";
```
2. Na chamada dentro do `Promise.all`, trocar (exemplo assessor):
```ts
getComissaoDoMes(userId, "assessor", mes, mes === mesAtual),
```
- Coord: role `"coordenador"`. Comercial: role `"comercial"`.

- [ ] **Step 3: Typecheck + testes existentes**

Run: `npx tsc --noEmit 2>&1 | grep -E "RemuneracaoCard|Dashboard(Assessor|Coord|Comercial)" || echo OK`
Expected: `OK`.
Run: `npx vitest run --exclude '**/.claude/**' tests/unit/dashboard-comissao.test.ts`
Expected: PASS (não tocamos `getComissaoPrevista`).

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/RemuneracaoCard.tsx src/components/dashboard/DashboardAssessor.tsx src/components/dashboard/DashboardCoord.tsx src/components/dashboard/DashboardComercial.tsx
git commit -m "feat(dashboard): card de remuneração reflete o mês escolhido (fechado/estimado/em curso)"
```

---

## Fase 3 — KPIs e gráficos por mês (assessor + coordenador)

Entrega: ao escolher um mês passado, KPIs (carteira/clientes/churn) reconstroem pro fim daquele mês e os gráficos terminam nele.

### Task 3.1: `_getKpisImpl` aceita `mesRef`

**Files:**
- Modify: `src/lib/dashboard/queries.ts` (`_getKpisImpl` e `getKpis`)
- Test: `tests/unit/dashboard-kpis-mes.test.ts` (criar)

- [ ] **Step 1: Teste que falha** (reconstrução de carteira/churn pra mês passado)

```ts
// tests/unit/dashboard-kpis-mes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

import { _getKpisImpl } from "@/lib/dashboard/queries";

beforeEach(() => fromMock.mockReset());

// Helper: clients query resolve thenable independente de eq/is/neq.
function clientsChain(rows: unknown[]) {
  const chain: any = {
    select: () => chain, eq: () => chain, is: () => chain, neq: () => chain,
    then: (r: any) => Promise.resolve({ data: rows }).then(r),
  };
  return chain;
}

it("reconstrói carteira ativa no fim do mês escolhido", async () => {
  fromMock.mockImplementation((table: string) => {
    if (table === "clients") {
      return clientsChain([
        // ativo no fim de 2026-04 (entrou antes, sem churn)
        { id: "c1", valor_mensal: 5000, data_entrada: "2026-01-10", data_churn: null, status: "ativo", tipo_relacao: "comum", modalidade: "mensal" },
        // entrou DEPOIS de abril -> não conta em abril
        { id: "c2", valor_mensal: 9000, data_entrada: "2026-06-01", data_churn: null, status: "ativo", tipo_relacao: "comum", modalidade: "mensal" },
      ]);
    }
    if (table === "client_monthly_adjustments") {
      return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [] }) }) };
    }
    if (table === "commission_snapshots") {
      return { select: () => ({ order: () => ({ limit: vi.fn().mockResolvedValue({ data: [] }) }) }) };
    }
    return {};
  });

  const r = await _getKpisImpl({ assessorId: "a1" }, "2026-04");
  expect(r.carteiraAtiva.valor).toBe(5000); // só c1
  expect(r.clientesAtivos.quantidade).toBe(1);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run --exclude '**/.claude/**' tests/unit/dashboard-kpis-mes.test.ts`
Expected: FAIL — `_getKpisImpl` só aceita 1 arg (TypeError ou resultado errado por usar "hoje").

- [ ] **Step 3: Parametrizar `_getKpisImpl`**

Em `src/lib/dashboard/queries.ts`, no início de `_getKpisImpl`, trocar a assinatura e as âncoras de data. Substituir as linhas 65-71 (assinatura + cálculo de monthRef/today/prev) por:

```ts
export async function _getKpisImpl(filter?: ClientFilter, mesRef?: string): Promise<KpiData> {
  const supabase = createServiceRoleClient();
  const mesAtual = getCurrentMonthYM();
  const monthRef = mesRef ?? mesAtual;
  const isMesAtual = monthRef === mesAtual;
  // "Hoje" pro mês atual; fim do mês pra meses fechados.
  const todayIso = isMesAtual ? getTodayDate() : lastDayOfMonth(monthRef);

  const prevMonthRef = previousMonthYM(monthRef);
  const prevMonthLastDay = lastDayOfMonth(prevMonthRef);
```

Adicionar `previousMonthYM` ao import de `./date-utils` (linha 5):
```ts
import { isInMonth, monthRange, lastDayOfMonth, previousMonthYM } from "./date-utils";
```

> Todo o resto de `_getKpisImpl` já usa `monthRef`, `todayIso`, `prevMonthRef`, `prevMonthLastDay`, `isActiveOn` — então passa a reconstruir o mês escolhido sem mais mudanças. O custo-comissão usa o snapshot do `monthRef` (linha que filtra por `ultimoMes`/`previewAllForMonth(monthRef)`), já coerente.

- [ ] **Step 4: `getKpis` repassa `mesRef` e entra na chave de cache**

Substituir `getKpis` (linhas 223-237) por:
```ts
export async function getKpis(filter?: ClientFilter, mesRef?: string): Promise<KpiData> {
  const cached = unstable_cache(
    async (paramsJson: string) => {
      const { f, m } = JSON.parse(paramsJson) as { f: ClientFilter | null; m: string | null };
      return _getKpisImpl(f ?? undefined, m ?? undefined);
    },
    ["dashboard-kpis-v6"],
    { revalidate: 300, tags: ["dashboard"] },
  );
  return cached(JSON.stringify({ f: filter ?? null, m: mesRef ?? null }));
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run --exclude '**/.claude/**' tests/unit/dashboard-kpis-mes.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dashboard/queries.ts tests/unit/dashboard-kpis-mes.test.ts
git commit -m "feat(dashboard): getKpis reconstrói KPIs pro mês escolhido"
```

### Task 3.2: Timeline/EntradaChurn terminam no mês + `getCarteiraPorAssessor` usa o mês

**Files:**
- Modify: `src/lib/dashboard/queries.ts` (`_getCarteiraTimelineImpl`/`getCarteiraTimeline`, `_getEntradaChurnImpl`/`getEntradaChurn`, `_getCarteiraPorAssessorImpl`/`getCarteiraPorAssessor`)
- Test: `tests/unit/dashboard-timeline-mes.test.ts` (criar)

- [ ] **Step 1: Teste que falha** (janela termina no mês escolhido)

```ts
// tests/unit/dashboard-timeline-mes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const fromMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => ({ from: fromMock }) }));
import { _getCarteiraTimelineImpl } from "@/lib/dashboard/queries";
beforeEach(() => fromMock.mockReset());

function clientsChain(rows: unknown[]) {
  const chain: any = { select: () => chain, eq: () => chain, is: () => chain, then: (r: any) => Promise.resolve({ data: rows }).then(r) };
  return chain;
}

it("a timeline termina no mês escolhido", async () => {
  fromMock.mockImplementation(() => clientsChain([]));
  const r = await _getCarteiraTimelineImpl(3, undefined, "2026-04");
  expect(r.map((p) => p.mes)).toEqual(["2026-02", "2026-03", "2026-04"]);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run --exclude '**/.claude/**' tests/unit/dashboard-timeline-mes.test.ts`
Expected: FAIL — termina no mês atual, não em 2026-04.

- [ ] **Step 3: Implementar `ateMes` nas duas timelines**

Em `_getCarteiraTimelineImpl` (assinatura linha ~246) e `_getEntradaChurnImpl` (assinatura ~259), trocar:
```ts
export async function _getCarteiraTimelineImpl(months: number, filter?: ClientFilter, ateMes?: string): Promise<TimelinePoint[]> {
  const supabase = createServiceRoleClient();
  const ancora = ateMes ? new Date(`${lastDayOfMonth(ateMes)}T12:00:00Z`) : new Date();
  const meses = monthRange(months, ancora);
```
(e o equivalente em `_getEntradaChurnImpl`, mantendo o resto idêntico).

Atualizar os wrappers cacheados pra repassar `ateMes` e incluí-lo no JSON da chave:
```ts
export async function getCarteiraTimeline(months = 12, filter?: ClientFilter, ateMes?: string): Promise<TimelinePoint[]> {
  const cached = unstable_cache(
    async (paramsJson: string) => {
      const { months: m, filter: f, ateMes: a } = JSON.parse(paramsJson) as { months: number; filter: ClientFilter | null; ateMes: string | null };
      return _getCarteiraTimelineImpl(m, f ?? undefined, a ?? undefined);
    },
    ["dashboard-carteira-timeline"],
    { revalidate: 300, tags: ["dashboard"] },
  );
  return cached(JSON.stringify({ months, filter: filter ?? null, ateMes: ateMes ?? null }));
}
```
(idem `getEntradaChurn`.)

- [ ] **Step 4: `getCarteiraPorAssessor` aceita `mesRef`**

Em `_getCarteiraPorAssessorImpl`, trocar a assinatura e o cálculo de `monthRef`:
```ts
export async function _getCarteiraPorAssessorImpl(filter?: ClientFilter, mesRef?: string): Promise<AssessorCarteira[]> {
  const supabase = createServiceRoleClient();
  const monthRef = mesRef ?? getCurrentMonthYM();
```
E o wrapper `getCarteiraPorAssessor` repassa `mesRef` + entra na chave (mesmo padrão dos outros).

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run --exclude '**/.claude/**' tests/unit/dashboard-timeline-mes.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dashboard/queries.ts tests/unit/dashboard-timeline-mes.test.ts
git commit -m "feat(dashboard): timeline/entrada-churn/carteira-por-assessor por mês"
```

### Task 3.3: Wiring assessor + coordenador (passa `mes` às queries, esconde cards forward-looking)

**Files:**
- Modify: `DashboardAssessor.tsx`, `DashboardCoord.tsx`

- [ ] **Step 1: Assessor — passar o mês e esconder forward-looking**

Em `DashboardAssessor.tsx`:
1. Derivar `const isMesAtual = mes === mesAtual;` no topo do componente.
2. No `Promise.all`, passar o mês:
```ts
getKpis(filter, mes),
getCarteiraTimeline(12, filter, mes),
getEntradaChurn(6, filter, mes),
getRankingSatisfacao(filter),
isMesAtual ? getProximosEventos(30, 10, { userId }) : Promise.resolve([]),
getComissaoDoMes(userId, "assessor", mes, isMesAtual),
```
3. Esconder as seções "Satisfação dos meus clientes" e "Próximos eventos meus" quando `!isMesAtual`, envolvendo cada uma:
```tsx
{isMesAtual && (
  <Section title="Satisfação dos meus clientes" /* ...resto igual... */>
    <RankingResumo top={ranking.top} bottom={ranking.bottom} />
  </Section>
)}
{isMesAtual && (
  <Section title="Próximos eventos meus" /* ...resto igual... */>
    <ProximosEventosList eventos={eventos} />
  </Section>
)}
```

- [ ] **Step 2: Coordenador — idem + IG/painel/alerta**

Em `DashboardCoord.tsx`:
1. `const isMesAtual = mes === mesAtual;`
2. `Promise.all`: `getKpis(filter, mes)`, `getCarteiraTimeline(12, filter, mes)`, `getEntradaChurn(6, filter, mes)`, `getCarteiraPorAssessor(filter, mes)`, `getComissaoDoMes(userId, "coordenador", mes, isMesAtual)`. Para os forward-looking, `isMesAtual ? getRankingSatisfacao(filter) : Promise.resolve({ top: [], bottom: [] })` e `isMesAtual ? getProximosEventos(...) : Promise.resolve([])`.
3. Envolver com `{isMesAtual && ( ... )}` as seções: AlertaOnboardingAtrasadoSection (Suspense), InstagramPostsSection (Suspense), "Satisfação dos meus clientes", "Próximos eventos meus", `<PainelAudiovisualSection />`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "Dashboard(Assessor|Coord)" || echo OK`
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/DashboardAssessor.tsx src/components/dashboard/DashboardCoord.tsx
git commit -m "feat(dashboard): assessor/coord refletem o mês e escondem cards 'pra frente' no passado"
```

---

## Fase 4 — Comercial por mês

Entrega: dashboard comercial reflete o mês escolhido (leads/meta/comissão) e esconde funil/reuniões em mês passado.

### Task 4.1: Wiring comercial

**Files:**
- Modify: `DashboardComercial.tsx`

> `getLeadsKpis(userId, now)` e `getMetaComercial(userId, now)` já aceitam `now`. `getFunnelData`/`getProximasReunioes` são ao vivo → escondidos no passado.

- [ ] **Step 1: Passar a data do mês e esconder forward-looking**

Em `DashboardComercial.tsx`:
1. Imports:
```ts
import { lastDayOfMonth } from "@/lib/dashboard/date-utils";
```
2. No componente:
```ts
const isMesAtual = mes === mesAtual;
const dataNoMes = isMesAtual ? new Date() : new Date(`${lastDayOfMonth(mes)}T12:00:00Z`);
```
3. `Promise.all`:
```ts
getLeadsKpis(userId, dataNoMes),
isMesAtual ? getFunnelData(userId) : Promise.resolve([]),
isMesAtual ? getProximasReunioes(userId, 14) : Promise.resolve([]),
getMetaComercial(userId, dataNoMes),
getComissaoDoMes(userId, "comercial", mes, isMesAtual),
```
4. Envolver com `{isMesAtual && ( ... )}` o bloco do grid "Funil de conversão"/`MetaTracker`? **Não** — a meta deve aparecer. Separar: manter `MetaTracker` sempre; esconder só o funil:
```tsx
<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
  {isMesAtual && (
    <Section title="Funil de conversão" subtitle="5 estágios atuais">
      <ChartFunilLazy data={funnel} />
    </Section>
  )}
  <MetaTracker meta={meta} />
</div>
```
5. Esconder a seção "Próximas reuniões" e a `InstagramPostsSection` (Suspense) com `{isMesAtual && ( ... )}`.

- [ ] **Step 2: Typecheck + suíte completa**

Run: `npx tsc --noEmit 2>&1 | grep -E "DashboardComercial" || echo OK`
Expected: `OK`.
Run: `npx vitest run --exclude '**/.claude/**' tests/unit/`
Expected: PASS (toda a suíte unitária).

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/DashboardComercial.tsx
git commit -m "feat(dashboard): comercial reflete o mês e esconde funil/reuniões no passado"
```

---

## Fase 5 — Fechamento

### Task 5.1: Verificação final + PR

- [ ] **Step 1: Suíte + lint + typecheck completos**

```bash
npx vitest run --exclude '**/.claude/**' tests/unit/
npm run lint
npm run typecheck
```
Expected: tudo verde (typecheck: ignorar erros de módulos ausentes não relacionados — remotion/qrcode/etc — que vêm do node_modules symlinkado da raiz; nenhum erro deve mencionar arquivos tocados aqui).

- [ ] **Step 2: Abrir PR e seguir o fluxo automático**

```bash
git push -u origin feat/dashboard-seletor-mes
gh pr create --base main \
  --title "feat(dashboard): seletor de mês (ver como fechou mês passado)" \
  --body "Adiciona um seletor de mês (dropdown 12 meses, ?mes=YYYY-MM) nos dashboards de assessor, coordenador e comercial. Mês passado: KPIs reconstruídos até o fim do mês, comissão do snapshot real (fechado/estimado), gráficos terminando no mês; cards forward-looking (próximos eventos, satisfação, IG, funil, reuniões) escondidos. Sem migration e sem bump de cache de shape. Spec: docs/superpowers/specs/2026-06-04-dashboard-seletor-mes-design.md."
```
Depois: esperar o CI (`ci.yml`) ficar verde e `gh pr merge --squash --delete-branch` (conforme combinado com a Yasmin). Sem migration.

---

## Notas de verificação (checklist da spec)

- [x] Dropdown 12 meses nos 3 dashboards (Task 1.2, 1.3)
- [x] `?mes=` validado, convive com `?as=` (Task 1.1, 1.3, MesSelector preserva params)
- [x] Comissão: snapshot fechado / estimado / em curso (Task 2.1–2.3)
- [x] KPIs reconstruídos pro fim do mês + delta vs mês anterior (Task 3.1)
- [x] Gráficos terminam no mês escolhido (Task 3.2)
- [x] Carteira por assessor usa ajustes do mês escolhido (Task 3.2)
- [x] Comercial: leads/meta por mês; funil/reuniões escondidos (Task 4.1)
- [x] Cards forward-looking escondidos no passado (Task 3.3, 4.1)
- [x] Cache com mês na chave (Task 3.1, 3.2)
- [x] Sem migration; fora de escopo: socio/adm/audiovisual/designer/editor
```
