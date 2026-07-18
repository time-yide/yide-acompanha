# Churn mensal histórico — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao clicar no card "Tempo médio de casa" do dashboard, abrir uma modal com a % de churn de todos os meses (mais nº de saídas e R$ perdido) pra comparar a tendência.

**Architecture:** Uma função pura `computeChurnMensal` (testável) calcula, mês a mês, a mesma fórmula de churn do KPI atual; um fetch cacheado `getChurnMensalHistorico` monta o range e chama a pura; a UI ganha um `KpiCard` clicável (nova prop `onClick`) e um client component `ChurnMensalCard` com a modal.

**Tech Stack:** Next.js (App Router, Server Components + client islands), TypeScript, Supabase service-role, vitest, Tailwind, lucide-react.

**Definição do churn (idêntica ao card, espelha `_getKpisImpl`):** por mês M — `churns` = clientes mensais comum com `data_churn` em M; `base` = mensais comum ativos no fim de M−1; `churnPct = churns/base×100` (null se base 0); `valorPerdido` = soma do `valor_mensal` dos churns.

**Branch:** já criada — `feat/churn-mensal-historico` a partir de `origin/main` (a main local vive atrás; todo o código-alvo só existe em origin/main). Spec commitado. NÃO trocar de branch.

---

## File Structure

- **Create** `src/lib/dashboard/churn-historico.ts` — tipos `ChurnClientRow`/`ChurnMensalPoint`, `computeChurnMensal` (pura), `getChurnMensalHistorico` (fetch + cache).
- **Create** `src/lib/dashboard/churn-historico.test.ts` — testes vitest da pura.
- **Create** `src/components/dashboard/ChurnMensalCard.tsx` — card clicável + modal (client).
- **Modify** `src/components/dashboard/KpiCard.tsx` — prop opcional `onClick`.
- **Modify** `src/components/dashboard/KpiRow.tsx` — prop `churnHistorico` + usa `ChurnMensalCard`.
- **Modify** `src/components/dashboard/sections.tsx` — `KpiRowSection` busca o histórico e passa adiante.

---

## Task 1: `computeChurnMensal` puro + testes (TDD)

**Files:**
- Create: `src/lib/dashboard/churn-historico.ts`
- Test: `src/lib/dashboard/churn-historico.test.ts`

- [ ] **Step 1: Escreve o teste que falha**

Create `src/lib/dashboard/churn-historico.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeChurnMensal, type ChurnClientRow } from "./churn-historico";

const clients: ChurnClientRow[] = [
  { data_entrada: "2026-01-01", data_churn: "2026-03-15", valor_mensal: 1000, modalidade: "mensal", tipo_relacao: "comum" }, // A: churn março
  { data_entrada: "2026-01-01", data_churn: null, valor_mensal: 500, modalidade: "mensal", tipo_relacao: "comum" },           // B: ativo
  { data_entrada: "2026-01-10", data_churn: null, valor_mensal: 500, modalidade: null, tipo_relacao: null },                  // C: ativo (defaults = mensal/comum)
  { data_entrada: "2026-02-01", data_churn: null, valor_mensal: 500, modalidade: "mensal", tipo_relacao: "comum" },           // F: entra em fev
  { data_entrada: "2026-01-01", data_churn: "2026-03-10", valor_mensal: 9999, modalidade: "pontual", tipo_relacao: "comum" }, // D: pontual → fora
  { data_entrada: "2026-01-01", data_churn: "2026-03-05", valor_mensal: 9999, modalidade: "mensal", tipo_relacao: "parceria" }, // E: parceria → fora
];

describe("computeChurnMensal", () => {
  const pts = computeChurnMensal(clients, ["2026-01", "2026-02", "2026-03"]);
  const byMes = Object.fromEntries(pts.map((p) => [p.mes, p]));

  it("mês inicial sem base → churnPct null", () => {
    // base = mensais comum ativos no fim de 2025-12 = 0
    expect(byMes["2026-01"]).toEqual({ mes: "2026-01", churnPct: null, churns: 0, valorPerdido: 0 });
  });

  it("mês sem churn → 0%", () => {
    // base fim de jan = A,B,C = 3 ; churns fev = 0
    expect(byMes["2026-02"]).toEqual({ mes: "2026-02", churnPct: 0, churns: 0, valorPerdido: 0 });
  });

  it("churn% = saídas ÷ base do mês anterior; só mensal comum", () => {
    // base fim de fev = A,B,C,F = 4 ; churns março (mensal comum) = A = 1 ; 1/4 = 25%
    expect(byMes["2026-03"]).toEqual({ mes: "2026-03", churnPct: 25, churns: 1, valorPerdido: 1000 });
  });

  it("pontual e parceria não entram na conta", () => {
    // D (pontual) e E (parceria) churnaram em março mas não contam
    expect(byMes["2026-03"].churns).toBe(1);
    expect(byMes["2026-03"].valorPerdido).toBe(1000);
  });

  it("sem meses → array vazio", () => {
    expect(computeChurnMensal(clients, [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Roda e confirma que falha**

Run: `npx vitest run --exclude '**/.claude/**' src/lib/dashboard/churn-historico.test.ts`
Expected: FAIL — "Failed to resolve import './churn-historico'".

> Nota: SEMPRE use `--exclude '**/.claude/**'` — o repo tem worktrees stale em `.claude/worktrees/` que o vitest globa e geram ~148 falhas alheias.

- [ ] **Step 3: Implementa a parte pura**

Create `src/lib/dashboard/churn-historico.ts`:

```ts
// SERVER-friendly, mas a parte de cálculo é pura (sem service-role) e testável.
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getCurrentMonthYM } from "@/lib/datetime/timezone";
import { isInMonth, lastDayOfMonth, monthRange, previousMonthYM } from "./date-utils";
import type { ClientFilter } from "./queries";

export interface ChurnClientRow {
  data_entrada: string;
  data_churn: string | null;
  valor_mensal: number;
  modalidade?: string | null;
  tipo_relacao?: string | null;
}

export interface ChurnMensalPoint {
  mes: string; // "YYYY-MM"
  churnPct: number | null; // null quando base = 0
  churns: number;
  valorPerdido: number;
}

const ehMensal = (c: ChurnClientRow) => !c.modalidade || c.modalidade === "mensal";
const ehComum = (c: ChurnClientRow) => !c.tipo_relacao || c.tipo_relacao === "comum";

/** Cliente ativo numa data (mesma regra de isActiveOn em queries.ts). */
function ativoEm(c: ChurnClientRow, dateIso: string): boolean {
  if (c.data_entrada > dateIso) return false;
  if (c.data_churn && c.data_churn <= dateIso) return false;
  return true;
}

/**
 * Churn % mês a mês. Só clientes MENSAIS COMUM entram (pontual/parceria fora).
 * base(M) = ativos no fim de M−1; churns(M) = data_churn em M.
 */
export function computeChurnMensal(
  clients: ChurnClientRow[],
  meses: string[],
): ChurnMensalPoint[] {
  const elegiveis = clients.filter((c) => ehMensal(c) && ehComum(c));
  return meses.map((mes) => {
    const fimAnterior = lastDayOfMonth(previousMonthYM(mes));
    const base = elegiveis.filter((c) => ativoEm(c, fimAnterior)).length;
    const churnsArr = elegiveis.filter((c) => isInMonth(c.data_churn, mes));
    const churns = churnsArr.length;
    const valorPerdido = churnsArr.reduce((acc, c) => acc + Number(c.valor_mensal), 0);
    return {
      mes,
      churnPct: base > 0 ? (churns / base) * 100 : null,
      churns,
      valorPerdido,
    };
  });
}

interface ClientFilterLike {
  unitId?: string | null;
  assessorId?: string | null;
  coordenadorId?: string | null;
}

async function _getChurnMensalHistoricoImpl(
  filter?: ClientFilterLike,
  ateMes?: string,
): Promise<ChurnMensalPoint[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  let q = sb
    .from("clients")
    .select("data_entrada, data_churn, valor_mensal, modalidade, tipo_relacao")
    .is("deleted_at", null)
    .eq("tipo_relacao", "comum")
    .neq("status", "em_onboarding");
  // Mesmo escopo multi-tenant/assessor que buildClientFilterQuery (privado em queries.ts).
  if (filter?.unitId) q = q.eq("unit_id", filter.unitId);
  if (filter?.assessorId) q = q.eq("assessor_id", filter.assessorId);
  if (filter?.coordenadorId) q = q.eq("coordenador_id", filter.coordenadorId);

  const { data } = await q;
  const clients = ((data ?? []) as ChurnClientRow[]).filter((c) => !!c.data_entrada);
  if (clients.length === 0) return [];

  const fim = ateMes ?? getCurrentMonthYM();
  const inicio = clients.reduce(
    (min, c) => (c.data_entrada < min ? c.data_entrada : min),
    clients[0].data_entrada,
  ).slice(0, 7);

  const [iy, im] = inicio.split("-").map(Number);
  const [fy, fm] = fim.split("-").map(Number);
  const count = (fy - iy) * 12 + (fm - im) + 1;
  if (count <= 0) return [];
  const meses = monthRange(count, new Date(Date.UTC(fy, fm - 1, 1)));

  return computeChurnMensal(clients, meses);
}

/** Histórico de churn mensal (cacheado 5min, tag dashboard). */
export async function getChurnMensalHistorico(
  filter?: ClientFilter,
  ateMes?: string,
): Promise<ChurnMensalPoint[]> {
  const cached = unstable_cache(
    async (paramsJson: string) => {
      const { filter: f, ateMes: a } = JSON.parse(paramsJson) as {
        filter: ClientFilterLike | null;
        ateMes: string | null;
      };
      return _getChurnMensalHistoricoImpl(f ?? undefined, a ?? undefined);
    },
    ["dashboard-churn-historico-v1"],
    { revalidate: 300, tags: ["dashboard"] },
  );
  return cached(JSON.stringify({ filter: filter ?? null, ateMes: ateMes ?? null }));
}
```

- [ ] **Step 4: Roda e confirma que passa**

Run: `npx vitest run --exclude '**/.claude/**' src/lib/dashboard/churn-historico.test.ts`
Expected: PASS — 5 testes verdes.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos em `churn-historico.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dashboard/churn-historico.ts src/lib/dashboard/churn-historico.test.ts
git commit -m "feat(dashboard): churn mensal histórico — cálculo puro + fetch cacheado + testes"
```

---

## Task 2: `KpiCard` clicável (prop `onClick`)

**Files:**
- Modify: `src/components/dashboard/KpiCard.tsx`

- [ ] **Step 1: Adiciona a prop `onClick` na interface `Props`**

Em `src/components/dashboard/KpiCard.tsx`, na interface `Props`, logo após a linha `href?: string;`, adiciona:

```ts
  /** Quando passado (e sem href), o card vira um botão clicável que dispara isto. */
  onClick?: () => void;
```

- [ ] **Step 2: Recebe `onClick` na assinatura e renderiza como botão**

Troca a assinatura da função:

```ts
export function KpiCard({ label, valor, delta, icon: Icon, helperText, href, onClick }: Props) {
```

E logo antes do bloco `if (href) { ... }` no final, adiciona um ramo pra `onClick` (mantém o `href` como está e o `div` como fallback):

```ts
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`block w-full text-left ${containerClasses}`}>
        {content}
      </button>
    );
  }
```

> `containerClasses` já aplica o hover/cursor quando `href` está presente; ajusta a condição pra incluir `onClick` também. Troca a linha que monta `containerClasses`:

```ts
  const containerClasses = `rounded-xl border bg-card p-3 space-y-1 sm:p-4 ${
    href || onClick ? "transition-colors hover:bg-muted/40 hover:border-primary/40 cursor-pointer" : ""
  }`;
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros em `KpiCard.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/KpiCard.tsx
git commit -m "feat(dashboard): KpiCard aceita onClick (vira botão clicável)"
```

---

## Task 3: `ChurnMensalCard` (card + modal)

**Files:**
- Create: `src/components/dashboard/ChurnMensalCard.tsx`

- [ ] **Step 1: Cria o componente**

Create `src/components/dashboard/ChurnMensalCard.tsx`:

```tsx
"use client";

import { useState, type ReactNode } from "react";
import { Clock, X } from "lucide-react";
import { KpiCard } from "./KpiCard";
import { Money } from "./HiddenValuesContext";
import { monthLabel } from "@/lib/dashboard/date-utils";
import type { ChurnMensalPoint } from "@/lib/dashboard/churn-historico";

interface Props {
  tempoNode: ReactNode;
  helper: ReactNode;
  historico: ChurnMensalPoint[];
}

export function ChurnMensalCard({ tempoNode, helper, historico }: Props) {
  const [open, setOpen] = useState(false);
  // Mais recente no topo.
  const linhas = [...historico].reverse();

  return (
    <>
      <KpiCard
        label="Tempo médio de casa"
        valor={tempoNode}
        helperText={helper}
        icon={Clock}
        onClick={() => setOpen(true)}
      />
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="churn-hist-titulo"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border bg-card p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 id="churn-hist-titulo" className="text-sm font-semibold">Churn mensal — histórico</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {linhas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem histórico ainda.</p>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-2 text-left font-medium">Mês</th>
                      <th className="py-2 text-right font-medium">Churn %</th>
                      <th className="py-2 text-right font-medium">Saíram</th>
                      <th className="py-2 text-right font-medium">R$ perdido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((p, i) => (
                      <tr key={p.mes} className={`border-t ${i === 0 ? "bg-muted/30" : ""}`}>
                        <td className="py-2 text-left">{monthLabel(p.mes)}</td>
                        <td className="py-2 text-right font-medium tabular-nums">
                          {p.churnPct !== null ? `${p.churnPct.toFixed(1)}%` : <span className="text-muted-foreground/50">—</span>}
                        </td>
                        <td className="py-2 text-right tabular-nums">{p.churns}</td>
                        <td className="py-2 text-right tabular-nums text-muted-foreground">
                          <Money value={p.valorPerdido} noDecimals />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros em `ChurnMensalCard.tsx`. (Vai acusar `KpiRow.tsx` só se ainda não passar a prop — corrigido na Task 4.)

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/ChurnMensalCard.tsx
git commit -m "feat(dashboard): ChurnMensalCard — card clicável com modal de histórico"
```

---

## Task 4: Liga `KpiRow` + `KpiRowSection`

**Files:**
- Modify: `src/components/dashboard/KpiRow.tsx`
- Modify: `src/components/dashboard/sections.tsx`

- [ ] **Step 1: `KpiRow` importa o card e o tipo, e recebe a prop nova**

Em `src/components/dashboard/KpiRow.tsx`, adiciona aos imports (após o import de `KpiCard`):

```ts
import { ChurnMensalCard } from "./ChurnMensalCard";
import type { ChurnMensalPoint } from "@/lib/dashboard/churn-historico";
```

Troca a assinatura do componente:

```ts
export function KpiRow({ kpis, churnHistorico }: { kpis: KpiData; churnHistorico: ChurnMensalPoint[] }) {
```

- [ ] **Step 2: Troca o card estático pelo clicável**

Substitui o bloco:

```tsx
      <KpiCard
        label="Tempo médio de casa"
        valor={tempoDisplay.node}
        helperText={tempoDisplay.helper}
        icon={Clock}
      />
```

por:

```tsx
      <ChurnMensalCard
        tempoNode={tempoDisplay.node}
        helper={tempoDisplay.helper}
        historico={churnHistorico}
      />
```

> `Clock` pode ficar importado sem uso — o `ChurnMensalCard` usa o seu próprio. Se o lint reclamar de import não usado, remove `Clock` do import do `lucide-react` em `KpiRow.tsx`.

- [ ] **Step 3: `KpiRowSection` busca o histórico e passa adiante**

Em `src/components/dashboard/sections.tsx`, adiciona ao topo (junto dos outros imports de `@/lib/dashboard/...`):

```ts
import { getChurnMensalHistorico } from "@/lib/dashboard/churn-historico";
```

Troca o corpo de `KpiRowSection` (linhas ~84-88):

```ts
export async function KpiRowSection({ mes }: { mes?: string }) {
  const unitId = await getEffectiveUnitId();
  const [kpis, churnHistorico] = await Promise.all([
    getKpis({ unitId }, mes),
    getChurnMensalHistorico({ unitId }, mes),
  ]);
  return <KpiRow kpis={kpis} churnHistorico={churnHistorico} />;
}
```

- [ ] **Step 4: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint src/components/dashboard/KpiRow.tsx src/components/dashboard/sections.tsx src/components/dashboard/ChurnMensalCard.tsx src/components/dashboard/KpiCard.tsx`
Expected: sem erros. (Se `Clock` sobrar sem uso em KpiRow, remove do import.)

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/KpiRow.tsx src/components/dashboard/sections.tsx
git commit -m "feat(dashboard): card Tempo médio de casa abre histórico de churn mensal"
```

---

## Task 5: PR

**Files:** nenhum.

- [ ] **Step 1: Roda os testes (excluindo worktrees) e type-check final**

Run: `npx tsc --noEmit && npx vitest run --exclude '**/.claude/**' src/lib/dashboard/churn-historico.test.ts`
Expected: tsc limpo; testes verdes.

- [ ] **Step 2: Push + PR**

```bash
git push -u origin feat/churn-mensal-historico
gh pr create --base main --title "feat(dashboard): histórico de churn mensal no card Tempo médio de casa" --body "$(cat <<'EOF'
## O que muda
Clicar no card **"Tempo médio de casa"** abre uma modal com a **% de churn de todos os meses** (mês · churn % · nº que saíram · R$ perdido), pra comparar a tendência.

- Mesma definição de churn do KPI (mensais comum: saídas do mês ÷ base ativa no fim do mês anterior) — a linha do mês corrente bate com o valor do card.
- Todo o histórico, do cliente mais antigo até o mês atual. Meses sem base → "—".
- R$ perdido usa `<Money>` (respeita o toggle de esconder valores).
- Cálculo puro testado (`computeChurnMensal`).

Sem migration.

Spec: `docs/superpowers/specs/2026-07-18-churn-mensal-historico-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: CI verde → merge**

Espera o check `test` do `ci.yml` verde, então `gh pr merge --squash --delete-branch`.

---

## Notas de verificação manual (pós-deploy)

- No dashboard (sócio/adm), clicar em "Tempo médio de casa" abre a modal.
- A % do mês corrente na modal == o "Churn mensal: X%" do card.
- Meses iniciais (sem base) mostram "—".
- Esconder valores (toggle do dashboard) esconde o R$ perdido.

## Riscos / suposições

- `computeChurnMensal` aplica `ehMensal`/`ehComum` mesmo o SQL já filtrando `tipo_relacao='comum'` — defesa em profundidade, e deixa a pura testável isoladamente.
- Filtro aplicado inline (unitId/assessorId/coordenadorId) espelha o `buildClientFilterQuery` privado de `queries.ts`; `KpiRowSection` passa só `{ unitId }`.
- Meses com base 0 no começo do histórico produzem `churnPct: null` — esperado, não é bug.
