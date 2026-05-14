# Dashboard de relatórios do onboarding — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Nova sub-página `/onboarding/relatorios` com funil de conversão visual premium + cards de métricas (CPL/CAC/Conversão/ROI/Ticket), no estilo dark SaaS com glow teal.

**Architecture:** Server component lê dados via `getOnboardingRelatorios(period)`. Cliente troca period via URL search param. Tabs de sub-nav (Kanban/Perdidos/Relatórios) compartilhadas. Cálculos puros isoláveis e testáveis. Visual usa o `primary` teal do projeto com glow CSS pra dar sensação neon.

**Tech Stack:** Next.js 16 (App Router), Supabase, React Server Components, Tailwind v4, lucide-react, Vitest.

**Spec:** [`docs/superpowers/specs/2026-05-13-onboarding-relatorios-design.md`](../specs/2026-05-13-onboarding-relatorios-design.md)

---

## Arquivos tocados

| Arquivo | Tipo |
|---|---|
| `tests/unit/onboarding-relatorios-queries.test.ts` | Criar |
| `src/lib/onboarding-relatorios/queries.ts` | Criar |
| `src/components/onboarding/TabsOnboarding.tsx` | Criar |
| `src/components/onboarding-relatorios/PeriodSelector.tsx` | Criar |
| `src/components/onboarding-relatorios/FunilConversao.tsx` | Criar |
| `src/components/onboarding-relatorios/MetricCards.tsx` | Criar |
| `src/app/(authed)/onboarding/relatorios/page.tsx` | Criar |
| `src/app/(authed)/onboarding/page.tsx` | Modificar (adicionar `<TabsOnboarding>`) |
| `src/app/(authed)/onboarding/perdidos/page.tsx` | Modificar (adicionar `<TabsOnboarding>`) |

---

## Task 1: Data layer (TDD)

**Files:**
- Create: `tests/unit/onboarding-relatorios-queries.test.ts`
- Create: `src/lib/onboarding-relatorios/queries.ts`

- [ ] **Step 1: Escrever testes**

Crie `tests/unit/onboarding-relatorios-queries.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ is: () => Promise.resolve({ data: [], error: null }) }),
      }),
    }),
  }),
}));

import {
  periodToRange,
  isValidPeriodKey,
  computeMetricas,
} from "@/lib/onboarding-relatorios/queries";

beforeEach(() => {
  vi.useFakeTimers();
  // 2026-05-15 12:00 UTC (quinta-feira do meio de maio)
  vi.setSystemTime(new Date("2026-05-15T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("isValidPeriodKey", () => {
  it("aceita as 4 keys válidas", () => {
    expect(isValidPeriodKey("este_mes")).toBe(true);
    expect(isValidPeriodKey("mes_passado")).toBe(true);
    expect(isValidPeriodKey("ultimos_3_meses")).toBe(true);
    expect(isValidPeriodKey("este_ano")).toBe(true);
  });
  it("rejeita lixo", () => {
    expect(isValidPeriodKey("foo")).toBe(false);
    expect(isValidPeriodKey(null)).toBe(false);
    expect(isValidPeriodKey(undefined)).toBe(false);
    expect(isValidPeriodKey(42)).toBe(false);
  });
});

describe("periodToRange", () => {
  it("este_mes: do 1º ao último dia do mês corrente", () => {
    const r = periodToRange("este_mes");
    expect(r.from.toISOString().slice(0, 10)).toBe("2026-05-01");
    expect(r.to.toISOString().slice(0, 10)).toBe("2026-05-31");
  });
  it("mes_passado: 1º ao último do mês anterior", () => {
    const r = periodToRange("mes_passado");
    expect(r.from.toISOString().slice(0, 10)).toBe("2026-04-01");
    expect(r.to.toISOString().slice(0, 10)).toBe("2026-04-30");
  });
  it("ultimos_3_meses: 3 meses pra trás até hoje", () => {
    const r = periodToRange("ultimos_3_meses");
    expect(r.from.toISOString().slice(0, 10)).toBe("2026-03-01");
    expect(r.to.toISOString().slice(0, 10)).toBe("2026-05-31");
  });
  it("este_ano: 1º jan ao último do ano corrente", () => {
    const r = periodToRange("este_ano");
    expect(r.from.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(r.to.toISOString().slice(0, 10)).toBe("2026-12-31");
  });
});

describe("computeMetricas", () => {
  it("caso normal — todos divisores não-zero", () => {
    const m = computeMetricas({
      gasto: 10000,
      leadsGerados: 100,
      vendasFechadas: 10,
      valorVendas: 50000,
    });
    expect(m.cpl).toBe(100);
    expect(m.cac).toBe(1000);
    expect(m.conversao).toBe(10);
    expect(m.roi).toBe(400);
    expect(m.ticket_medio).toBe(5000);
  });

  it("leads_gerados = 0 → CPL e Conversão são null", () => {
    const m = computeMetricas({
      gasto: 1000, leadsGerados: 0, vendasFechadas: 0, valorVendas: 0,
    });
    expect(m.cpl).toBeNull();
    expect(m.conversao).toBeNull();
  });

  it("vendas_fechadas = 0 → CAC e Ticket são null", () => {
    const m = computeMetricas({
      gasto: 1000, leadsGerados: 50, vendasFechadas: 0, valorVendas: 0,
    });
    expect(m.cac).toBeNull();
    expect(m.ticket_medio).toBeNull();
  });

  it("gasto = 0 → ROI null", () => {
    const m = computeMetricas({
      gasto: 0, leadsGerados: 50, vendasFechadas: 5, valorVendas: 10000,
    });
    expect(m.roi).toBeNull();
  });

  it("ROI negativo quando valor_vendas < gasto", () => {
    const m = computeMetricas({
      gasto: 10000, leadsGerados: 100, vendasFechadas: 5, valorVendas: 5000,
    });
    expect(m.roi).toBe(-50);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**
```bash
npm test -- tests/unit/onboarding-relatorios-queries.test.ts
```
Esperado: `Cannot find module`.

- [ ] **Step 3: Criar `src/lib/onboarding-relatorios/queries.ts`**

```typescript
// SERVER ONLY: do not import from client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type PeriodKey = "este_mes" | "mes_passado" | "ultimos_3_meses" | "este_ano";

const PERIOD_KEYS: readonly PeriodKey[] = [
  "este_mes",
  "mes_passado",
  "ultimos_3_meses",
  "este_ano",
];

export function isValidPeriodKey(s: unknown): s is PeriodKey {
  return typeof s === "string" && (PERIOD_KEYS as readonly string[]).includes(s);
}

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  este_mes: "Este mês",
  mes_passado: "Mês passado",
  ultimos_3_meses: "Últimos 3 meses",
  este_ano: "Este ano",
};

/** Retorna [from, to] em UTC. `to` é o último dia (23:59:59) do range. */
export function periodToRange(period: PeriodKey): { from: Date; to: Date } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  switch (period) {
    case "este_mes":
      return {
        from: new Date(Date.UTC(y, m, 1)),
        to: new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999)),
      };
    case "mes_passado":
      return {
        from: new Date(Date.UTC(y, m - 1, 1)),
        to: new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)),
      };
    case "ultimos_3_meses":
      return {
        from: new Date(Date.UTC(y, m - 2, 1)),
        to: new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999)),
      };
    case "este_ano":
      return {
        from: new Date(Date.UTC(y, 0, 1)),
        to: new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999)),
      };
  }
}

/** Número de meses no range — usado pra multiplicar gasto mensal de tráfego. */
function monthsInRange(period: PeriodKey): number {
  switch (period) {
    case "este_mes":
    case "mes_passado":
      return 1;
    case "ultimos_3_meses":
      return 3;
    case "este_ano": {
      // Conta meses já decorridos no ano corrente.
      return new Date().getUTCMonth() + 1;
    }
  }
}

export interface MetricCards {
  cpl: number | null;
  cac: number | null;
  conversao: number | null;
  roi: number | null;
  ticket_medio: number | null;
}

interface RawCounts {
  gasto: number;
  leadsGerados: number;
  vendasFechadas: number;
  valorVendas: number;
}

export function computeMetricas(c: RawCounts): MetricCards {
  return {
    cpl: c.leadsGerados > 0 ? c.gasto / c.leadsGerados : null,
    cac: c.vendasFechadas > 0 ? c.gasto / c.vendasFechadas : null,
    conversao: c.leadsGerados > 0 ? (c.vendasFechadas / c.leadsGerados) * 100 : null,
    roi: c.gasto > 0 ? ((c.valorVendas - c.gasto) / c.gasto) * 100 : null,
    ticket_medio: c.vendasFechadas > 0 ? c.valorVendas / c.vendasFechadas : null,
  };
}

export interface FunilStep {
  key:
    | "gasto_total"
    | "leads_pagos"
    | "leads_organicos"
    | "leads_gerados"
    | "reunioes"
    | "vendas_fechadas"
    | "valor_vendas";
  label: string;
  valor: number;
  formato: "moeda" | "numero";
  placeholder?: boolean;
}

export interface RelatorioData {
  funil: FunilStep[];
  metricas: MetricCards;
  period: { from: Date; to: Date };
  periodKey: PeriodKey;
}

export async function getOnboardingRelatorios(
  period: PeriodKey,
): Promise<RelatorioData> {
  const range = periodToRange(period);
  const months = monthsInRange(period);

  const admin = createServiceRoleClient();

  // 1. Gasto total — soma dos valores mensais de tráfego dos clientes ativos,
  //    multiplicada pelo número de meses do período.
  const { data: clientsData } = await admin
    .from("clients")
    .select("valor_trafego_google, valor_trafego_meta")
    .eq("status", "ativo")
    .is("deleted_at", null);
  const clients = (clientsData ?? []) as Array<{
    valor_trafego_google: number | null;
    valor_trafego_meta: number | null;
  }>;
  const gastoMensal = clients.reduce(
    (acc, c) => acc + Number(c.valor_trafego_google ?? 0) + Number(c.valor_trafego_meta ?? 0),
    0,
  );
  const gastoTotal = gastoMensal * months;

  // 2. Leads gerados.
  const { count: leadsGeradosCount } = await admin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .gte("created_at", range.from.toISOString())
    .lte("created_at", range.to.toISOString());
  const leadsGerados = leadsGeradosCount ?? 0;

  // 3. Reuniões realizadas — depende do módulo reuniões maturar. Por enquanto
  //    vai retornar 0 em produção (sem inserts em meetings).
  const { count: reunioesCount } = await admin
    .from("meetings")
    .select("id", { count: "exact", head: true })
    .eq("status", "realizada")
    .gte("starts_at", range.from.toISOString())
    .lte("starts_at", range.to.toISOString());
  const reunioes = reunioesCount ?? 0;

  // 4. Vendas fechadas + valor — leads que viraram cliente no período.
  const { data: vendasData } = await admin
    .from("leads")
    .select("valor_proposto")
    .eq("stage", "ativo")
    .gte("data_fechamento", range.from.toISOString().slice(0, 10))
    .lte("data_fechamento", range.to.toISOString().slice(0, 10));
  const vendas = (vendasData ?? []) as Array<{ valor_proposto: number | null }>;
  const vendasFechadas = vendas.length;
  const valorVendas = vendas.reduce((acc, v) => acc + Number(v.valor_proposto ?? 0), 0);

  const funil: FunilStep[] = [
    { key: "gasto_total", label: "Gasto total", valor: gastoTotal, formato: "moeda" },
    { key: "leads_pagos", label: "Leads pagos", valor: 0, formato: "numero", placeholder: true },
    { key: "leads_organicos", label: "Leads orgânicos", valor: 0, formato: "numero", placeholder: true },
    { key: "leads_gerados", label: "Leads gerados", valor: leadsGerados, formato: "numero" },
    { key: "reunioes", label: "Reuniões realizadas", valor: reunioes, formato: "numero", placeholder: reunioes === 0 },
    { key: "vendas_fechadas", label: "Vendas fechadas", valor: vendasFechadas, formato: "numero" },
    { key: "valor_vendas", label: "Valor em vendas", valor: valorVendas, formato: "moeda" },
  ];

  const metricas = computeMetricas({
    gasto: gastoTotal,
    leadsGerados,
    vendasFechadas,
    valorVendas,
  });

  return { funil, metricas, period: range, periodKey: period };
}
```

- [ ] **Step 4: Rodar testes — todos passam**
```bash
npm test -- tests/unit/onboarding-relatorios-queries.test.ts
```
Esperado: 11 testes passando.

- [ ] **Step 5: Typecheck + commit**
```bash
npm run typecheck
git add tests/unit/onboarding-relatorios-queries.test.ts src/lib/onboarding-relatorios/queries.ts
git commit -m "$(cat <<'EOF'
feat(onboarding-relatorios): queries + cálculo de métricas

Helper getOnboardingRelatorios pega gasto de tráfego, leads gerados,
reuniões realizadas, vendas fechadas e valor vendido no período.
computeMetricas calcula CPL/CAC/Conversão/ROI/Ticket com guards de
div/0 retornando null. Placeholders pra leads pagos/orgânicos (sem
classificação de origem) e reuniões (módulo em Fase 0/1).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Componente de tabs (sub-nav)

**Files:**
- Create: `src/components/onboarding/TabsOnboarding.tsx`

- [ ] **Step 1: Criar o componente**

```typescript
import Link from "next/link";
import { LayoutGrid, XCircle, BarChart3 } from "lucide-react";

type TabKey = "kanban" | "perdidos" | "relatorios";

interface Props {
  active: TabKey;
}

const TABS: Array<{ key: TabKey; label: string; href: string; Icon: typeof LayoutGrid }> = [
  { key: "kanban", label: "Kanban", href: "/onboarding", Icon: LayoutGrid },
  { key: "perdidos", label: "Perdidos", href: "/onboarding/perdidos", Icon: XCircle },
  { key: "relatorios", label: "Relatórios", href: "/onboarding/relatorios", Icon: BarChart3 },
];

export function TabsOnboarding({ active }: Props) {
  return (
    <nav className="flex flex-wrap items-center gap-1 border-b border-border/60 pb-px">
      {TABS.map(({ key, label, href, Icon }) => {
        const isActive = key === active;
        return (
          <Link
            key={key}
            href={href}
            className={
              isActive
                ? "inline-flex items-center gap-1.5 rounded-t-lg border border-b-0 border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary shadow-[0_0_24px_-12px] shadow-primary/40"
                : "inline-flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
            }
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add src/components/onboarding/TabsOnboarding.tsx
git commit -m "feat(onboarding): sub-nav de tabs (Kanban/Perdidos/Relatórios)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: PeriodSelector (client)

**Files:**
- Create: `src/components/onboarding-relatorios/PeriodSelector.tsx`

```typescript
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Calendar } from "lucide-react";
import { PERIOD_LABELS, type PeriodKey } from "@/lib/onboarding-relatorios/queries";

interface Props {
  current: PeriodKey;
}

const ORDER: PeriodKey[] = ["este_mes", "mes_passado", "ultimos_3_meses", "este_ano"];

export function PeriodSelector({ current }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as PeriodKey;
    const usp = new URLSearchParams(params?.toString());
    usp.set("period", next);
    startTransition(() => {
      router.replace(`/onboarding/relatorios?${usp.toString()}`);
    });
  }

  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-3 py-1.5 text-sm">
      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
      <select
        value={current}
        onChange={handleChange}
        disabled={pending}
        className="bg-transparent text-sm font-medium outline-none"
      >
        {ORDER.map((k) => (
          <option key={k} value={k}>
            {PERIOD_LABELS[k]}
          </option>
        ))}
      </select>
    </label>
  );
}
```

Commit:
```bash
git add src/components/onboarding-relatorios/PeriodSelector.tsx
git commit -m "feat(onboarding-relatorios): seletor de período (URL search param)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: FunilConversao + MetricCards

**Files:**
- Create: `src/components/onboarding-relatorios/FunilConversao.tsx`
- Create: `src/components/onboarding-relatorios/MetricCards.tsx`

- [ ] **Step 1: Criar `FunilConversao.tsx`**

```typescript
import type { FunilStep } from "@/lib/onboarding-relatorios/queries";

interface Props {
  funil: FunilStep[];
}

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function formatValor(step: FunilStep): string {
  return step.formato === "moeda" ? BRL(step.valor) : step.valor.toLocaleString("pt-BR");
}

function computeWidths(funil: FunilStep[]): number[] {
  const max = Math.max(...funil.map((s) => s.valor), 1);
  // Largura proporcional, com floor monotônico (forma de funil) e mínimo 10%.
  let prev = 100;
  return funil.map((s) => {
    const raw = (s.valor / max) * 100;
    const capped = Math.min(raw, prev);
    const final = Math.max(capped, 10);
    prev = final;
    return final;
  });
}

function conversao(curr: number, prev: number): string {
  if (prev === 0) return "—";
  return `${((curr / prev) * 100).toFixed(1)}%`;
}

export function FunilConversao({ funil }: Props) {
  const widths = computeWidths(funil);

  return (
    <section className="rounded-2xl border border-border/60 bg-card/40 p-6 shadow-[0_0_40px_-20px] shadow-primary/20 sm:p-8">
      <header className="mb-6">
        <h2 className="text-base font-semibold tracking-tight">Funil de conversão</h2>
        <p className="text-xs text-muted-foreground">
          Do investimento em tráfego até o valor em vendas no período
        </p>
      </header>

      <div className="space-y-2">
        {funil.map((step, i) => {
          const prev = i > 0 ? funil[i - 1].valor : null;
          return (
            <div key={step.key} className="space-y-1">
              {prev !== null && (
                <div className="flex justify-center">
                  <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    ↓ {conversao(step.valor, prev)}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="flex flex-1 items-center gap-3">
                  <div className="min-w-[160px] text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {step.label}
                    {step.placeholder && (
                      <span
                        className="ml-2 inline-flex items-center rounded-full bg-muted/30 px-1.5 py-0.5 text-[9px] font-medium normal-case tracking-normal text-muted-foreground/70"
                        title="Fonte de dados em construção"
                      >
                        Em breve
                      </span>
                    )}
                  </div>
                  <div className="relative h-9 flex-1 overflow-hidden rounded-lg bg-muted/30">
                    <div
                      className="animate-funil-grow h-full rounded-lg bg-gradient-to-r from-primary via-primary/85 to-primary/40 shadow-[0_0_24px_-6px] shadow-primary/50"
                      style={{
                        width: `${widths[i]}%`,
                        animationDelay: `${i * 80}ms`,
                      }}
                    />
                  </div>
                </div>
                <div className="min-w-[140px] text-right text-base font-bold tabular-nums">
                  {formatValor(step)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Criar `MetricCards.tsx`**

```typescript
import { DollarSign, Users, TrendingUp, Target, Award } from "lucide-react";
import type { MetricCards as MetricCardsType } from "@/lib/onboarding-relatorios/queries";

interface Props {
  metricas: MetricCardsType;
}

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface CardSpec {
  key: keyof MetricCardsType;
  label: string;
  icon: typeof DollarSign;
  format: (v: number) => string;
  negativeIsBad?: boolean;
}

const CARDS: CardSpec[] = [
  { key: "cpl", label: "CPL", icon: DollarSign, format: BRL },
  { key: "cac", label: "CAC", icon: Target, format: BRL },
  {
    key: "conversao",
    label: "Conversão",
    icon: TrendingUp,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: "roi",
    label: "ROI",
    icon: Award,
    format: (v) => `${v.toFixed(0)}%`,
    negativeIsBad: true,
  },
  { key: "ticket_medio", label: "Ticket médio", icon: Users, format: BRL },
];

export function MetricCards({ metricas }: Props) {
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {CARDS.map(({ key, label, icon: Icon, format, negativeIsBad }, i) => {
        const valor = metricas[key];
        const isNegative = negativeIsBad && valor !== null && valor < 0;
        return (
          <div
            key={key}
            className="animate-card-rise rounded-2xl border border-primary/20 bg-card/40 p-4 shadow-[0_0_24px_-12px] shadow-primary/40"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Icon className="h-3 w-3" />
              {label}
            </div>
            <div
              className={`mt-2 text-xl font-bold tabular-nums ${
                isNegative ? "text-rose-500" : "text-foreground"
              }`}
            >
              {valor === null ? "—" : format(valor)}
            </div>
          </div>
        );
      })}
    </section>
  );
}
```

- [ ] **Step 3: Commit**
```bash
git add src/components/onboarding-relatorios/FunilConversao.tsx src/components/onboarding-relatorios/MetricCards.tsx
git commit -m "feat(onboarding-relatorios): FunilConversao + MetricCards

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Animações CSS

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Adicionar `@keyframes` no globals.css**

Encontre o final do arquivo e adicione:

```css
@keyframes funil-grow {
  from { width: 0 !important; opacity: 0; }
  to { opacity: 1; }
}

@keyframes card-rise {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-funil-grow {
  animation: funil-grow 800ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.animate-card-rise {
  animation: card-rise 400ms ease-out both;
}
```

- [ ] **Step 2: Commit**
```bash
git add src/app/globals.css
git commit -m "feat(onboarding-relatorios): keyframes pras animações de entrada

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Page `/onboarding/relatorios` + tabs nas páginas existentes

**Files:**
- Create: `src/app/(authed)/onboarding/relatorios/page.tsx`
- Modify: `src/app/(authed)/onboarding/page.tsx`
- Modify: `src/app/(authed)/onboarding/perdidos/page.tsx`

- [ ] **Step 1: Criar `relatorios/page.tsx`**

```typescript
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import {
  getOnboardingRelatorios,
  isValidPeriodKey,
  PERIOD_LABELS,
  type PeriodKey,
} from "@/lib/onboarding-relatorios/queries";
import { TabsOnboarding } from "@/components/onboarding/TabsOnboarding";
import { PeriodSelector } from "@/components/onboarding-relatorios/PeriodSelector";
import { FunilConversao } from "@/components/onboarding-relatorios/FunilConversao";
import { MetricCards } from "@/components/onboarding-relatorios/MetricCards";

const ROLES_PERMITIDOS = ["adm", "socio", "comercial", "assessor", "coordenador", "audiovisual_chefe"];

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(user.role)) redirect("/");

  const sp = await searchParams;
  const periodKey: PeriodKey = isValidPeriodKey(sp.period) ? sp.period : "este_mes";

  const data = await getOnboardingRelatorios(periodKey);

  return (
    <div className="space-y-6">
      <TabsOnboarding active="relatorios" />

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visão analítica do funil — {PERIOD_LABELS[periodKey].toLowerCase()}
          </p>
        </div>
        <PeriodSelector current={periodKey} />
      </header>

      <FunilConversao funil={data.funil} />
      <MetricCards metricas={data.metricas} />
    </div>
  );
}
```

- [ ] **Step 2: Adicionar `<TabsOnboarding active="kanban" />` no topo do `/onboarding/page.tsx`**

Encontre:
```tsx
  return (
    <div className="space-y-5">
      {/* Kanban atualiza ao vivo quando qualquer um move/cria/marca lead. */}
      <OnboardingRealtimeWatcher />
      <header className="flex flex-wrap items-center justify-between gap-3">
```

Adicione import:
```typescript
import { TabsOnboarding } from "@/components/onboarding/TabsOnboarding";
```

Insira `<TabsOnboarding>` logo antes de `<header>`:
```tsx
  return (
    <div className="space-y-5">
      {/* Kanban atualiza ao vivo quando qualquer um move/cria/marca lead. */}
      <OnboardingRealtimeWatcher />
      <TabsOnboarding active="kanban" />
      <header className="flex flex-wrap items-center justify-between gap-3">
```

Como agora tem tab pra perdidos, remova o `<Link href="/onboarding/perdidos">...</Link>` do header (a aba já cobre essa navegação). Mantenha só o botão "Novo prospect" no header.

- [ ] **Step 3: Adicionar `<TabsOnboarding active="perdidos" />` no `/onboarding/perdidos/page.tsx`**

Adicione import e renderize a tab no topo do return, exatamente como em `/onboarding/page.tsx` (mas com `active="perdidos"`).

- [ ] **Step 4: Verificar tudo**

```bash
npm run typecheck && npm run lint && npm test -- tests/unit/onboarding-relatorios-queries.test.ts
```
Esperado: 0 erros novos, 11 testes do relatorios passando.

- [ ] **Step 5: Commit**

```bash
git add 'src/app/(authed)/onboarding/relatorios/page.tsx' 'src/app/(authed)/onboarding/page.tsx' 'src/app/(authed)/onboarding/perdidos/page.tsx'
git commit -m "$(cat <<'EOF'
feat(onboarding): página /onboarding/relatorios + tabs nas páginas existentes

Sub-página com funil de conversão visual + cards de métricas. Tabs
(Kanban/Perdidos/Relatórios) adicionadas em /onboarding e
/onboarding/perdidos pra navegar entre as três views.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Push + PR

```bash
git push -u origin claude/onboarding-relatorios

gh pr create --title "feat(onboarding): dashboard de relatórios (funil + métricas)"  --body "..."
```

(Body do PR descrito no momento da execução.)

---

## Self-review
- [x] Spec coverage: rota, sub-nav, data layer, componentes visuais, animação, placeholders, métricas, edge cases — todos cobertos
- [x] Placeholders: nenhum
- [x] Type consistency: `PeriodKey`, `FunilStep`, `MetricCards`, `RelatorioData` usados consistentemente
- [x] Commits frequentes: 6 commits
