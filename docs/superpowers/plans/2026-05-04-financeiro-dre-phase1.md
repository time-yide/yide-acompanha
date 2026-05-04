# Financeiro Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a aba `/financeiro` (só sócio) com DRE mensal completo + CRUD de despesas + bulk import via CSV/texto.

**Architecture:** 2 tabelas novas (`expenses` + `expense_overrides`) com RLS estrita pra sócio. DRE combina dados existentes (clients, commission_snapshots, profiles, valor_trafego_*) com despesas manuais. Helpers puros pra cálculo, queries cacheadas, server actions com permissão em camadas.

**Tech Stack:** Next.js 16 (App Router), Supabase Postgres, Zod, vitest, Tailwind, lucide-react.

**Spec:** [docs/superpowers/specs/2026-05-04-financeiro-dre-design.md](../specs/2026-05-04-financeiro-dre-design.md)

---

## File Map

**Create (DB):**
- `supabase/migrations/20260504000039_financeiro_expenses.sql` — tabelas + RLS

**Create (lib):**
- `src/lib/financeiro/schema.ts` — Zod schemas + categorias canônicas
- `src/lib/financeiro/dre-calc.ts` — pure helpers (vigência, valor com override, agrupar, margem)
- `src/lib/financeiro/queries.ts` — `getDRE`, `getDRESeries`, `listExpenses`, `getExpenseById`
- `src/lib/financeiro/actions.ts` — server actions
- `src/lib/financeiro/import.ts` — parser CSV/texto pra bulk import

**Create (components):**
- `src/components/financeiro/DRELine.tsx`
- `src/components/financeiro/DREView.tsx`
- `src/components/financeiro/MesSelector.tsx`
- `src/components/financeiro/ViewModeToggle.tsx`
- `src/components/financeiro/OverrideDialog.tsx`
- `src/components/financeiro/ExpenseForm.tsx`
- `src/components/financeiro/ExpenseTable.tsx`
- `src/components/financeiro/ExpenseFilters.tsx`
- `src/components/financeiro/BulkExpenseImportForm.tsx`

**Create (pages):**
- `src/app/(authed)/financeiro/page.tsx` — DRE
- `src/app/(authed)/financeiro/despesas/page.tsx` — listagem CRUD
- `src/app/(authed)/financeiro/despesas/importar/page.tsx` — bulk import

**Create (tests):**
- `tests/unit/financeiro-dre-calc.test.ts`
- `tests/unit/financeiro-import.test.ts`

**Modify:**
- `src/components/layout/Sidebar.tsx` — adicionar item "Financeiro" (só sócio), entre Comissões e Satisfação
- `src/types/database.ts` — vai precisar regenerar após aplicar migration (gerado, não manual)

---

## Task 1: Migration SQL

**Files:**
- Create: `supabase/migrations/20260504000039_financeiro_expenses.sql`

- [ ] **Step 1: Cria o arquivo de migration**

```sql
-- supabase/migrations/20260504000039_financeiro_expenses.sql
-- Tabelas pra Financeiro Phase 1: catálogo de despesas + overrides mensais.
-- RLS estrita: só sócio lê/escreve.

-- ─── expenses ──────────────────────────────────────────────────────────────
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  descricao text not null,
  categoria text not null check (categoria in (
    'aluguel', 'software', 'contabilidade', 'impostos',
    'marketing_proprio', 'equipamento', 'pro_labore', 'outros'
  )),
  tipo text not null check (tipo in ('fixa', 'avulsa')),
  valor numeric(14, 2) not null check (valor >= 0),

  -- Avulsa: mês do lançamento (YYYY-MM). Fixa: null.
  mes_referencia text null check (
    (tipo = 'avulsa' and mes_referencia ~ '^\d{4}-\d{2}$')
    or (tipo = 'fixa' and mes_referencia is null)
  ),

  -- Fixa: vigência (inclusivo no início, exclusivo no fim). Null = sem limite.
  inicio_mes text null check (inicio_mes is null or inicio_mes ~ '^\d{4}-\d{2}$'),
  fim_mes text null check (fim_mes is null or fim_mes ~ '^\d{4}-\d{2}$'),

  notas text null,
  criado_por uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expenses_org_tipo on public.expenses(organization_id, tipo);
create index expenses_avulsa_mes on public.expenses(organization_id, mes_referencia)
  where tipo = 'avulsa';

alter table public.expenses enable row level security;

create policy "socio rw expenses" on public.expenses
  for all to authenticated
  using (current_user_role() = 'socio'::user_role)
  with check (current_user_role() = 'socio'::user_role);

-- ─── expense_overrides ──────────────────────────────────────────────────────
create table public.expense_overrides (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  mes_referencia text not null check (mes_referencia ~ '^\d{4}-\d{2}$'),
  valor numeric(14, 2) not null check (valor >= 0),
  motivo text null,
  criado_por uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (expense_id, mes_referencia)
);

create index expense_overrides_mes on public.expense_overrides(mes_referencia);

alter table public.expense_overrides enable row level security;

create policy "socio rw expense_overrides" on public.expense_overrides
  for all to authenticated
  using (current_user_role() = 'socio'::user_role)
  with check (current_user_role() = 'socio'::user_role);

-- ─── trigger updated_at ─────────────────────────────────────────────────────
create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();
```

- [ ] **Step 2: Aplica a migration na DB de prod via Supabase Dashboard**

1. Abrir Supabase Dashboard → projeto da Yide → **SQL Editor**
2. **+ New query** → colar o SQL inteiro acima → **Run**
3. Esperar "Success. No rows returned"
4. Confirma que as 2 tabelas existem: `select 'ok' from public.expenses limit 1; select 'ok' from public.expense_overrides limit 1;` (ambos devem rodar sem erro mesmo retornando 0 linhas)

> Nota: o user já fez esse fluxo antes (PR #58). Quando o PR mergear, o arquivo de migration entra no repo; aplicar manualmente é apenas pra desbloquear o desenvolvimento agora.

- [ ] **Step 3: Regenera os types da DB**

Comando (se MCP autorizado): `mcp__supabase__generate_typescript_types`. Caso contrário, esperar próxima sync ou regenerar localmente com `supabase gen types`.

Se nada disso for possível neste momento, prossegue sem regenerar — as queries usam casts manuais quando necessário.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260504000039_financeiro_expenses.sql
git commit -m "feat(financeiro): migration com tabelas expenses + expense_overrides + RLS de sócio"
```

---

## Task 2: Schema Zod + categorias canônicas

**Files:**
- Create: `src/lib/financeiro/schema.ts`

- [ ] **Step 1: Cria o schema**

```typescript
// src/lib/financeiro/schema.ts
import { z } from "zod";

export const EXPENSE_CATEGORIAS = [
  "aluguel",
  "software",
  "contabilidade",
  "impostos",
  "marketing_proprio",
  "equipamento",
  "pro_labore",
  "outros",
] as const;
export type ExpenseCategoria = (typeof EXPENSE_CATEGORIAS)[number];

export const CATEGORIA_LABEL: Record<ExpenseCategoria, string> = {
  aluguel: "Aluguel",
  software: "Software",
  contabilidade: "Contabilidade",
  impostos: "Impostos",
  marketing_proprio: "Marketing próprio",
  equipamento: "Equipamento",
  pro_labore: "Pró-labore",
  outros: "Outros",
};

export const EXPENSE_TIPOS = ["fixa", "avulsa"] as const;
export type ExpenseTipo = (typeof EXPENSE_TIPOS)[number];

const monthRegex = /^\d{4}-\d{2}$/;

const baseSchema = z.object({
  descricao: z.string().trim().min(2, "Descrição muito curta").max(200),
  categoria: z.enum(EXPENSE_CATEGORIAS),
  tipo: z.enum(EXPENSE_TIPOS),
  valor: z.coerce.number().min(0, "Valor não pode ser negativo"),
  mes_referencia: z.string().regex(monthRegex).optional().nullable(),
  inicio_mes: z.string().regex(monthRegex).optional().nullable(),
  fim_mes: z.string().regex(monthRegex).optional().nullable(),
  notas: z.string().trim().max(1000).optional().nullable(),
});

export const createExpenseSchema = baseSchema.refine(
  (d) => d.tipo === "avulsa" ? !!d.mes_referencia : !d.mes_referencia,
  { message: "Avulsa exige mes_referencia; fixa não aceita.", path: ["mes_referencia"] },
).refine(
  (d) => d.tipo === "fixa" || (!d.inicio_mes && !d.fim_mes),
  { message: "inicio_mes/fim_mes só fazem sentido pra fixa.", path: ["inicio_mes"] },
).refine(
  (d) => !d.fim_mes || !d.inicio_mes || d.fim_mes > d.inicio_mes,
  { message: "fim_mes precisa ser maior que inicio_mes.", path: ["fim_mes"] },
);

export const updateExpenseSchema = baseSchema.extend({
  id: z.string().uuid(),
}).refine(
  (d) => d.tipo === "avulsa" ? !!d.mes_referencia : !d.mes_referencia,
  { message: "Avulsa exige mes_referencia; fixa não aceita.", path: ["mes_referencia"] },
).refine(
  (d) => d.tipo === "fixa" || (!d.inicio_mes && !d.fim_mes),
  { message: "inicio_mes/fim_mes só fazem sentido pra fixa.", path: ["inicio_mes"] },
).refine(
  (d) => !d.fim_mes || !d.inicio_mes || d.fim_mes > d.inicio_mes,
  { message: "fim_mes precisa ser maior que inicio_mes.", path: ["fim_mes"] },
);

export const overrideSchema = z.object({
  expense_id: z.string().uuid(),
  mes_referencia: z.string().regex(monthRegex),
  valor: z.coerce.number().min(0),
  motivo: z.string().trim().max(500).optional().nullable(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type OverrideInput = z.infer<typeof overrideSchema>;

export const FINANCEIRO_CACHE_TAG = "financeiro";
```

- [ ] **Step 2: Verifica typecheck**

Comando: `npx tsc --noEmit`
Esperado: EXIT=0

- [ ] **Step 3: Commit**

```bash
git add src/lib/financeiro/schema.ts
git commit -m "feat(financeiro): schema Zod + categorias canônicas + cache tag"
```

---

## Task 3: Helpers `dre-calc.ts` + tests (TDD)

**Files:**
- Create: `src/lib/financeiro/dre-calc.ts`
- Create: `tests/unit/financeiro-dre-calc.test.ts`

- [ ] **Step 1: Escreve o teste falhando**

```typescript
// tests/unit/financeiro-dre-calc.test.ts
import { describe, it, expect } from "vitest";
import {
  expenseAplicaNoMes,
  valorNoMes,
  calcMargem,
  type ExpenseRow,
  type OverrideRow,
} from "@/lib/financeiro/dre-calc";

function expense(o: Partial<ExpenseRow> = {}): ExpenseRow {
  return {
    id: o.id ?? "e1",
    descricao: "Aluguel",
    categoria: "aluguel",
    tipo: o.tipo ?? "fixa",
    valor: o.valor ?? 5000,
    mes_referencia: o.mes_referencia ?? null,
    inicio_mes: o.inicio_mes ?? null,
    fim_mes: o.fim_mes ?? null,
  };
}

describe("expenseAplicaNoMes", () => {
  it("avulsa aplica só no mes_referencia", () => {
    const e = expense({ tipo: "avulsa", mes_referencia: "2026-05" });
    expect(expenseAplicaNoMes(e, "2026-05")).toBe(true);
    expect(expenseAplicaNoMes(e, "2026-04")).toBe(false);
    expect(expenseAplicaNoMes(e, "2026-06")).toBe(false);
  });

  it("fixa sem início/fim aplica em qualquer mês", () => {
    const e = expense({ tipo: "fixa" });
    expect(expenseAplicaNoMes(e, "2026-01")).toBe(true);
    expect(expenseAplicaNoMes(e, "2030-12")).toBe(true);
  });

  it("fixa com inicio_mes não aplica antes", () => {
    const e = expense({ tipo: "fixa", inicio_mes: "2026-05" });
    expect(expenseAplicaNoMes(e, "2026-04")).toBe(false);
    expect(expenseAplicaNoMes(e, "2026-05")).toBe(true);
    expect(expenseAplicaNoMes(e, "2026-06")).toBe(true);
  });

  it("fixa com fim_mes não aplica a partir dele (exclusivo)", () => {
    const e = expense({ tipo: "fixa", inicio_mes: "2026-01", fim_mes: "2026-06" });
    expect(expenseAplicaNoMes(e, "2026-05")).toBe(true);
    expect(expenseAplicaNoMes(e, "2026-06")).toBe(false);
    expect(expenseAplicaNoMes(e, "2026-07")).toBe(false);
  });
});

describe("valorNoMes", () => {
  it("usa valor padrão quando não tem override", () => {
    const e = expense({ valor: 5000 });
    expect(valorNoMes(e, "2026-05", [])).toBe(5000);
  });

  it("usa valor do override quando existe pra esse mês", () => {
    const e = expense({ id: "e1", valor: 5000 });
    const overrides: OverrideRow[] = [
      { id: "o1", expense_id: "e1", mes_referencia: "2026-05", valor: 5500 },
    ];
    expect(valorNoMes(e, "2026-05", overrides)).toBe(5500);
  });

  it("ignora override de outro mês", () => {
    const e = expense({ id: "e1", valor: 5000 });
    const overrides: OverrideRow[] = [
      { id: "o1", expense_id: "e1", mes_referencia: "2026-04", valor: 4500 },
    ];
    expect(valorNoMes(e, "2026-05", overrides)).toBe(5000);
  });

  it("ignora override de outra expense", () => {
    const e = expense({ id: "e1", valor: 5000 });
    const overrides: OverrideRow[] = [
      { id: "o1", expense_id: "e2", mes_referencia: "2026-05", valor: 9999 },
    ];
    expect(valorNoMes(e, "2026-05", overrides)).toBe(5000);
  });
});

describe("calcMargem", () => {
  it("retorna 0 quando denom é 0", () => {
    expect(calcMargem(100, 0)).toBe(0);
  });
  it("retorna proporção", () => {
    expect(calcMargem(50, 100)).toBe(0.5);
  });
  it("aceita lucro negativo", () => {
    expect(calcMargem(-50, 100)).toBe(-0.5);
  });
});
```

- [ ] **Step 2: Roda o teste pra confirmar que falha**

Comando: `npx vitest run tests/unit/financeiro-dre-calc.test.ts`
Esperado: FAIL com "Cannot find module '@/lib/financeiro/dre-calc'"

- [ ] **Step 3: Implementa o helper**

```typescript
// src/lib/financeiro/dre-calc.ts
import type { ExpenseCategoria, ExpenseTipo } from "./schema";

export interface ExpenseRow {
  id: string;
  descricao: string;
  categoria: ExpenseCategoria;
  tipo: ExpenseTipo;
  valor: number;
  mes_referencia: string | null;
  inicio_mes: string | null;
  fim_mes: string | null;
}

export interface OverrideRow {
  id: string;
  expense_id: string;
  mes_referencia: string;
  valor: number;
}

/** True se a despesa se aplica ao mes (formato YYYY-MM). */
export function expenseAplicaNoMes(e: ExpenseRow, mesRef: string): boolean {
  if (e.tipo === "avulsa") {
    return e.mes_referencia === mesRef;
  }
  // fixa
  if (e.inicio_mes && mesRef < e.inicio_mes) return false;
  if (e.fim_mes && mesRef >= e.fim_mes) return false;
  return true;
}

/** Valor da despesa naquele mês — usa override se existir, senão valor padrão. */
export function valorNoMes(e: ExpenseRow, mesRef: string, overrides: OverrideRow[]): number {
  const ov = overrides.find((o) => o.expense_id === e.id && o.mes_referencia === mesRef);
  return ov ? Number(ov.valor) : Number(e.valor);
}

/** Margem como proporção (0 quando denom=0, pra evitar divisão por zero). */
export function calcMargem(num: number, denom: number): number {
  if (denom === 0) return 0;
  return num / denom;
}
```

- [ ] **Step 4: Roda os tests pra confirmar que passa**

Comando: `npx vitest run tests/unit/financeiro-dre-calc.test.ts`
Esperado: PASS (todos os cases)

- [ ] **Step 5: Commit**

```bash
git add src/lib/financeiro/dre-calc.ts tests/unit/financeiro-dre-calc.test.ts
git commit -m "feat(financeiro): helpers dre-calc (vigência, valor com override, margem) + tests"
```

---

## Task 4: Queries (`getDRE`, `getDRESeries`, `listExpenses`, `getExpenseById`)

**Files:**
- Create: `src/lib/financeiro/queries.ts`

- [ ] **Step 1: Cria o arquivo**

```typescript
// src/lib/financeiro/queries.ts
// SERVER ONLY
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { previewAllForMonth } from "@/lib/comissoes/preview";
import {
  expenseAplicaNoMes,
  valorNoMes,
  calcMargem,
  type ExpenseRow,
  type OverrideRow,
} from "./dre-calc";
import type { ExpenseCategoria, ExpenseTipo } from "./schema";
import { FINANCEIRO_CACHE_TAG } from "./schema";

export interface DRELine {
  expenseId: string;
  descricao: string;
  categoria: ExpenseCategoria;
  valor: number;
  overrideAplicado: boolean;
}

export interface DREData {
  mesRef: string;
  receita_bruta: number;
  custo_servicos: { comissoes: number; trafego: number; total: number };
  lucro_bruto: number;
  margem_bruta_pct: number;
  salarios: number;
  despesas: DRELine[];
  total_despesas: number;
  lucro_operacional: number;
  margem_operacional_pct: number;
}

/** Verifica se cliente estava ativo em algum momento durante o mês (YYYY-MM). */
function clienteAtivoNoMes(c: { data_entrada: string; data_churn: string | null }, mesRef: string): boolean {
  const inicioMes = `${mesRef}-01`;
  const fimMes = `${mesRef}-31`;
  if (c.data_entrada > fimMes) return false;
  if (c.data_churn && c.data_churn < inicioMes) return false;
  return true;
}

async function _getDREImpl(mesRef: string): Promise<DREData> {
  const supabase = createServiceRoleClient();

  // ── Receita: clientes ativos no mês com tipo_relacao='comum'
  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, valor_mensal, valor_trafego_google, valor_trafego_meta, data_entrada, data_churn, tipo_relacao, status")
    .neq("status", "em_onboarding");
  const allClients = (clientsData ?? []) as Array<{
    id: string;
    valor_mensal: number;
    valor_trafego_google: number | null;
    valor_trafego_meta: number | null;
    data_entrada: string;
    data_churn: string | null;
    tipo_relacao: string | null;
    status: string;
  }>;
  const ativosNoMes = allClients.filter((c) => clienteAtivoNoMes(c, mesRef));
  const ativosComum = ativosNoMes.filter((c) => !c.tipo_relacao || c.tipo_relacao === "comum");

  const receita_bruta = ativosComum.reduce((a, c) => a + Number(c.valor_mensal), 0);
  const trafego = ativosNoMes.reduce(
    (a, c) => a + Number(c.valor_trafego_google ?? 0) + Number(c.valor_trafego_meta ?? 0),
    0,
  );

  // ── Comissões: snapshot ou preview live
  const { data: snapshotsData } = await supabase
    .from("commission_snapshots")
    .select("valor_total")
    .eq("mes_referencia", mesRef);
  const snapshots = (snapshotsData ?? []) as Array<{ valor_total: number }>;
  let comissoes = snapshots.reduce((a, s) => a + Number(s.valor_total), 0);

  if (comissoes === 0) {
    const previewRows = await previewAllForMonth(mesRef);
    comissoes = previewRows.reduce((a, r) => a + Number(r.valor_total), 0);
  }

  // ── Salários: profiles ativos, exceto sócio (pró-labore vai como despesa manual)
  const { data: profilesData } = await supabase
    .from("profiles")
    .select("fixo_mensal, role, ativo")
    .eq("ativo", true)
    .neq("role", "socio");
  const salarios = ((profilesData ?? []) as Array<{ fixo_mensal: number }>).reduce(
    (a, p) => a + Number(p.fixo_mensal ?? 0),
    0,
  );

  // ── Despesas manuais
  const { data: expensesData } = await supabase
    .from("expenses")
    .select("id, descricao, categoria, tipo, valor, mes_referencia, inicio_mes, fim_mes");
  const expenses = (expensesData ?? []) as ExpenseRow[];

  const expenseIds = expenses.map((e) => e.id);
  const { data: overridesData } = expenseIds.length === 0
    ? { data: [] }
    : await supabase
        .from("expense_overrides")
        .select("id, expense_id, mes_referencia, valor")
        .eq("mes_referencia", mesRef)
        .in("expense_id", expenseIds);
  const overrides = (overridesData ?? []) as OverrideRow[];

  const despesas: DRELine[] = expenses
    .filter((e) => expenseAplicaNoMes(e, mesRef))
    .map((e) => {
      const ov = overrides.find((o) => o.expense_id === e.id);
      return {
        expenseId: e.id,
        descricao: e.descricao,
        categoria: e.categoria,
        valor: valorNoMes(e, mesRef, overrides),
        overrideAplicado: !!ov,
      };
    });

  const total_despesas = despesas.reduce((a, d) => a + d.valor, 0);
  const custo_servicos_total = comissoes + trafego;
  const lucro_bruto = receita_bruta - custo_servicos_total;
  const lucro_operacional = lucro_bruto - salarios - total_despesas;

  return {
    mesRef,
    receita_bruta,
    custo_servicos: { comissoes, trafego, total: custo_servicos_total },
    lucro_bruto,
    margem_bruta_pct: calcMargem(lucro_bruto, receita_bruta) * 100,
    salarios,
    despesas,
    total_despesas,
    lucro_operacional,
    margem_operacional_pct: calcMargem(lucro_operacional, receita_bruta) * 100,
  };
}

export async function getDRE(mesRef: string): Promise<DREData> {
  const cached = unstable_cache(
    async (mes: string) => _getDREImpl(mes),
    ["financeiro-dre"],
    { revalidate: 300, tags: [FINANCEIRO_CACHE_TAG, "dashboard"] },
  );
  return cached(mesRef);
}

export async function getDRESeries(meses: string[]): Promise<DREData[]> {
  return Promise.all(meses.map((m) => getDRE(m)));
}

export interface ExpenseListRow extends ExpenseRow {
  notas: string | null;
  created_at: string;
}

export async function listExpenses(filters?: {
  tipo?: ExpenseTipo;
  categoria?: ExpenseCategoria;
  mes_referencia?: string;  // só pra avulsas
}): Promise<ExpenseListRow[]> {
  const supabase = createServiceRoleClient();
  let query = supabase
    .from("expenses")
    .select("id, descricao, categoria, tipo, valor, mes_referencia, inicio_mes, fim_mes, notas, created_at")
    .order("created_at", { ascending: false });
  if (filters?.tipo) query = query.eq("tipo", filters.tipo);
  if (filters?.categoria) query = query.eq("categoria", filters.categoria);
  if (filters?.mes_referencia) query = query.eq("mes_referencia", filters.mes_referencia);
  const { data } = await query;
  return (data ?? []) as ExpenseListRow[];
}

export async function getExpenseById(id: string): Promise<ExpenseListRow | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("expenses")
    .select("id, descricao, categoria, tipo, valor, mes_referencia, inicio_mes, fim_mes, notas, created_at")
    .eq("id", id)
    .single();
  return (data as ExpenseListRow | null) ?? null;
}
```

- [ ] **Step 2: Verifica typecheck**

Comando: `npx tsc --noEmit`
Esperado: EXIT=0. Se aparecer erro de tipo dizendo que `expenses`/`expense_overrides` não estão em `Database["public"]["Tables"]`, é porque a migration ainda não foi sincronizada nos types — adiciona um cast `as any` nos `from("expenses")` / `from("expense_overrides")` apenas onde o TS reclamar, e abre uma nota no commit pra regenerar types depois.

- [ ] **Step 3: Commit**

```bash
git add src/lib/financeiro/queries.ts
git commit -m "feat(financeiro): queries getDRE/getDRESeries/listExpenses/getExpenseById"
```

---

## Task 5: Server actions — CRUD de expenses

**Files:**
- Create: `src/lib/financeiro/actions.ts`

- [ ] **Step 1: Cria o arquivo**

```typescript
// src/lib/financeiro/actions.ts
"use server";

import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import {
  createExpenseSchema,
  updateExpenseSchema,
  overrideSchema,
  FINANCEIRO_CACHE_TAG,
} from "./schema";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fd(formData: FormData, key: string) {
  const v = formData.get(key);
  return v === null || v === "" ? undefined : String(v);
}

async function requireSocio() {
  const actor = await requireAuth();
  if (actor.role !== "socio") {
    throw new Error("Apenas sócio pode acessar Financeiro");
  }
  return actor;
}

function revalidateAll(expenseId?: string) {
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/despesas");
  if (expenseId) revalidatePath(`/financeiro/despesas/${expenseId}`);
  revalidateTag(FINANCEIRO_CACHE_TAG);
}

export async function createExpenseAction(formData: FormData) {
  const actor = await requireSocio();

  const parsed = createExpenseSchema.safeParse({
    descricao: fd(formData, "descricao"),
    categoria: fd(formData, "categoria"),
    tipo: fd(formData, "tipo"),
    valor: fd(formData, "valor") ?? 0,
    mes_referencia: fd(formData, "mes_referencia"),
    inicio_mes: fd(formData, "inicio_mes"),
    fim_mes: fd(formData, "fim_mes"),
    notas: fd(formData, "notas"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
  if (!org) return { error: "Organização não encontrada" };

  const insertPayload = {
    organization_id: org.id,
    descricao: parsed.data.descricao,
    categoria: parsed.data.categoria,
    tipo: parsed.data.tipo,
    valor: parsed.data.valor,
    mes_referencia: parsed.data.mes_referencia ?? null,
    inicio_mes: parsed.data.inicio_mes ?? null,
    fim_mes: parsed.data.fim_mes ?? null,
    notas: parsed.data.notas ?? null,
    criado_por: actor.id,
  };

  const { data: created, error } = await supabase
    .from("expenses")
    .insert(insertPayload)
    .select("id")
    .single();
  if (error || !created) return { error: error?.message ?? "Falha ao criar despesa" };

  await logAudit({
    entidade: "expenses",
    entidade_id: created.id,
    acao: "create",
    dados_depois: insertPayload as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  revalidateAll();
  return { success: true as const, id: created.id };
}

export async function updateExpenseAction(formData: FormData) {
  const actor = await requireSocio();

  const parsed = updateExpenseSchema.safeParse({
    id: fd(formData, "id"),
    descricao: fd(formData, "descricao"),
    categoria: fd(formData, "categoria"),
    tipo: fd(formData, "tipo"),
    valor: fd(formData, "valor") ?? 0,
    mes_referencia: fd(formData, "mes_referencia"),
    inicio_mes: fd(formData, "inicio_mes"),
    fim_mes: fd(formData, "fim_mes"),
    notas: fd(formData, "notas"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: before } = await supabase.from("expenses").select("*").eq("id", parsed.data.id).single();
  if (!before) return { error: "Despesa não encontrada" };

  const updatePayload = {
    descricao: parsed.data.descricao,
    categoria: parsed.data.categoria,
    tipo: parsed.data.tipo,
    valor: parsed.data.valor,
    mes_referencia: parsed.data.mes_referencia ?? null,
    inicio_mes: parsed.data.inicio_mes ?? null,
    fim_mes: parsed.data.fim_mes ?? null,
    notas: parsed.data.notas ?? null,
  };

  const { error } = await supabase.from("expenses").update(updatePayload).eq("id", parsed.data.id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "expenses",
    entidade_id: parsed.data.id,
    acao: "update",
    dados_antes: before as unknown as Record<string, unknown>,
    dados_depois: updatePayload as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  revalidateAll(parsed.data.id);
  return { success: true as const };
}

export async function deactivateExpenseAction(id: string) {
  const actor = await requireSocio();
  if (!UUID_RE.test(id)) return { error: "ID inválido" };

  const supabase = await createClient();
  const { data: before } = await supabase.from("expenses").select("*").eq("id", id).single();
  if (!before) return { error: "Despesa não encontrada" };
  if ((before as { tipo: string }).tipo !== "fixa") {
    return { error: "Desativação só faz sentido pra despesa fixa" };
  }

  const now = new Date();
  const proxMes = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const fim_mes = `${proxMes.getFullYear()}-${String(proxMes.getMonth() + 1).padStart(2, "0")}`;

  const { error } = await supabase.from("expenses").update({ fim_mes }).eq("id", id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "expenses",
    entidade_id: id,
    acao: "update",
    dados_antes: { fim_mes: (before as { fim_mes: string | null }).fim_mes },
    dados_depois: { fim_mes },
    ator_id: actor.id,
    justificativa: "Desativação via /financeiro/despesas",
  });

  revalidateAll(id);
  return { success: true as const };
}

const deleteSchema = z.object({
  id: z.string().uuid(),
  justificativa: z.string().min(3, "Informe o motivo (mín. 3 caracteres)"),
});

export async function deleteExpenseAction(formData: FormData) {
  const actor = await requireSocio();

  const parsed = deleteSchema.safeParse({
    id: fd(formData, "id"),
    justificativa: fd(formData, "justificativa"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: before } = await supabase.from("expenses").select("*").eq("id", parsed.data.id).single();
  if (!before) return { error: "Despesa não encontrada" };

  await logAudit({
    entidade: "expenses",
    entidade_id: parsed.data.id,
    acao: "delete",
    dados_antes: before as unknown as Record<string, unknown>,
    ator_id: actor.id,
    justificativa: parsed.data.justificativa,
  });

  const { data: deleted, error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", parsed.data.id)
    .select("id");
  if (error) return { error: error.message };
  if (!deleted || deleted.length === 0) {
    return { error: "Falha ao excluir (verifique permissões RLS)" };
  }

  revalidateAll();
  return { success: true as const };
}

export async function setOverrideAction(formData: FormData) {
  const actor = await requireSocio();

  const parsed = overrideSchema.safeParse({
    expense_id: fd(formData, "expense_id"),
    mes_referencia: fd(formData, "mes_referencia"),
    valor: fd(formData, "valor") ?? 0,
    motivo: fd(formData, "motivo"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: expense } = await supabase
    .from("expenses")
    .select("tipo")
    .eq("id", parsed.data.expense_id)
    .single();
  if (!expense) return { error: "Despesa não encontrada" };
  if ((expense as { tipo: string }).tipo !== "fixa") {
    return { error: "Override só faz sentido pra despesa fixa" };
  }

  const upsertPayload = {
    expense_id: parsed.data.expense_id,
    mes_referencia: parsed.data.mes_referencia,
    valor: parsed.data.valor,
    motivo: parsed.data.motivo ?? null,
    criado_por: actor.id,
  };

  const { error } = await supabase
    .from("expense_overrides")
    .upsert(upsertPayload, { onConflict: "expense_id,mes_referencia" });
  if (error) return { error: error.message };

  await logAudit({
    entidade: "expense_overrides",
    entidade_id: parsed.data.expense_id,
    acao: "update",
    dados_depois: upsertPayload as unknown as Record<string, unknown>,
    ator_id: actor.id,
    justificativa: parsed.data.motivo ?? undefined,
  });

  revalidateAll(parsed.data.expense_id);
  return { success: true as const };
}

export async function removeOverrideAction(expenseId: string, mesRef: string) {
  const actor = await requireSocio();
  if (!UUID_RE.test(expenseId)) return { error: "ID inválido" };
  if (!/^\d{4}-\d{2}$/.test(mesRef)) return { error: "Mês inválido" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("expense_overrides")
    .delete()
    .eq("expense_id", expenseId)
    .eq("mes_referencia", mesRef);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "expense_overrides",
    entidade_id: expenseId,
    acao: "delete",
    dados_antes: { mes_referencia: mesRef },
    ator_id: actor.id,
  });

  revalidateAll(expenseId);
  return { success: true as const };
}
```

- [ ] **Step 2: Verifica typecheck**

Comando: `npx tsc --noEmit`
Esperado: EXIT=0 (mesmas notas da Task 4 sobre cast `as any` em tabelas novas se TS reclamar)

- [ ] **Step 3: Commit**

```bash
git add src/lib/financeiro/actions.ts
git commit -m "feat(financeiro): server actions CRUD de expenses + override (sócio only)"
```

---

## Task 6: Bulk import — parser + action + tests

**Files:**
- Create: `src/lib/financeiro/import.ts`
- Create: `tests/unit/financeiro-import.test.ts`
- Modify: `src/lib/financeiro/actions.ts` (adiciona `bulkImportExpensesAction` no fim)

- [ ] **Step 1: Escreve o teste falhando**

```typescript
// tests/unit/financeiro-import.test.ts
import { describe, it, expect } from "vitest";
import { parseBulkExpenses } from "@/lib/financeiro/import";

describe("parseBulkExpenses", () => {
  it("aceita TAB e vírgula como separador", () => {
    const text = "Aluguel\taluguel\t5000\tfixa\nNotion,software,300,fixa";
    const r = parseBulkExpenses(text);
    expect(r.errors).toHaveLength(0);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].descricao).toBe("Aluguel");
    expect(r.rows[1].categoria).toBe("software");
  });

  it("ignora cabeçalho se primeira linha contém 'descricao'", () => {
    const text = "descricao,categoria,valor,tipo\nAluguel,aluguel,5000,fixa";
    const r = parseBulkExpenses(text);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].descricao).toBe("Aluguel");
  });

  it("avulsa exige mes_referencia", () => {
    const text = "iMac,equipamento,12000,avulsa";
    const r = parseBulkExpenses(text);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors[0].mensagem).toMatch(/mes_referencia/i);
  });

  it("avulsa com mes_referencia válido passa", () => {
    const text = "iMac,equipamento,12000,avulsa,2026-05";
    const r = parseBulkExpenses(text);
    expect(r.errors).toHaveLength(0);
    expect(r.rows[0].mes_referencia).toBe("2026-05");
  });

  it("rejeita categoria fora do enum", () => {
    const text = "Algo,inventada,100,fixa";
    const r = parseBulkExpenses(text);
    expect(r.errors[0].mensagem).toMatch(/categoria/i);
  });

  it("rejeita valor não-numérico", () => {
    const text = "Aluguel,aluguel,abc,fixa";
    const r = parseBulkExpenses(text);
    expect(r.errors[0].mensagem).toMatch(/valor/i);
  });

  it("ignora linhas vazias", () => {
    const text = "\n\nAluguel,aluguel,5000,fixa\n\n";
    const r = parseBulkExpenses(text);
    expect(r.rows).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Roda pra falhar**

Comando: `npx vitest run tests/unit/financeiro-import.test.ts`
Esperado: FAIL com "Cannot find module '@/lib/financeiro/import'"

- [ ] **Step 3: Implementa o parser**

```typescript
// src/lib/financeiro/import.ts
import { EXPENSE_CATEGORIAS, EXPENSE_TIPOS, type ExpenseCategoria, type ExpenseTipo } from "./schema";

export interface ImportRow {
  descricao: string;
  categoria: ExpenseCategoria;
  valor: number;
  tipo: ExpenseTipo;
  mes_referencia: string | null;
  inicio_mes: string | null;
  fim_mes: string | null;
  notas: string | null;
  /** índice da linha original (1-based) pra mostrar erro pro usuário */
  linha: number;
}

export interface ImportError {
  linha: number;
  raw: string;
  mensagem: string;
}

export interface ImportResult {
  rows: ImportRow[];
  errors: ImportError[];
}

const HEADER_TOKENS = ["descricao", "descrição", "categoria", "valor", "tipo"];
const MONTH_RE = /^\d{4}-\d{2}$/;

function splitFields(line: string): string[] {
  // TAB tem prioridade; se não tem TAB, usa vírgula
  if (line.includes("\t")) return line.split("\t").map((s) => s.trim());
  return line.split(",").map((s) => s.trim());
}

export function parseBulkExpenses(text: string): ImportResult {
  const rows: ImportRow[] = [];
  const errors: ImportError[] = [];
  const lines = text.split(/\r?\n/);

  let isFirstNonEmpty = true;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const linhaNum = i + 1;
    const fields = splitFields(trimmed);

    // Pula header
    if (isFirstNonEmpty) {
      isFirstNonEmpty = false;
      const lower = fields.map((f) => f.toLowerCase());
      if (HEADER_TOKENS.some((tok) => lower.includes(tok))) continue;
    }

    if (fields.length < 4) {
      errors.push({ linha: linhaNum, raw, mensagem: "Mínimo 4 colunas: descricao, categoria, valor, tipo" });
      continue;
    }

    const [descricao, categoria, valorStr, tipo, mesRef, inicio, fim, notas] = fields;

    if (!descricao || descricao.length < 2) {
      errors.push({ linha: linhaNum, raw, mensagem: "Descrição muito curta" });
      continue;
    }
    if (!EXPENSE_CATEGORIAS.includes(categoria as ExpenseCategoria)) {
      errors.push({
        linha: linhaNum, raw,
        mensagem: `Categoria inválida (use: ${EXPENSE_CATEGORIAS.join(", ")})`,
      });
      continue;
    }
    const valor = Number(valorStr);
    if (!Number.isFinite(valor) || valor < 0) {
      errors.push({ linha: linhaNum, raw, mensagem: "Valor inválido" });
      continue;
    }
    if (!EXPENSE_TIPOS.includes(tipo as ExpenseTipo)) {
      errors.push({ linha: linhaNum, raw, mensagem: 'Tipo deve ser "fixa" ou "avulsa"' });
      continue;
    }

    const mes_referencia = mesRef && MONTH_RE.test(mesRef) ? mesRef : null;
    if (tipo === "avulsa" && !mes_referencia) {
      errors.push({ linha: linhaNum, raw, mensagem: "Avulsa exige mes_referencia (formato YYYY-MM)" });
      continue;
    }
    if (tipo === "fixa" && mes_referencia) {
      errors.push({ linha: linhaNum, raw, mensagem: "Fixa não aceita mes_referencia" });
      continue;
    }

    const inicio_mes = inicio && MONTH_RE.test(inicio) ? inicio : null;
    const fim_mes = fim && MONTH_RE.test(fim) ? fim : null;

    if (tipo !== "fixa" && (inicio_mes || fim_mes)) {
      errors.push({ linha: linhaNum, raw, mensagem: "inicio_mes/fim_mes só pra fixa" });
      continue;
    }
    if (fim_mes && inicio_mes && fim_mes <= inicio_mes) {
      errors.push({ linha: linhaNum, raw, mensagem: "fim_mes deve ser maior que inicio_mes" });
      continue;
    }

    rows.push({
      descricao,
      categoria: categoria as ExpenseCategoria,
      valor,
      tipo: tipo as ExpenseTipo,
      mes_referencia,
      inicio_mes,
      fim_mes,
      notas: notas?.trim() || null,
      linha: linhaNum,
    });
  }

  return { rows, errors };
}
```

- [ ] **Step 4: Roda pra passar**

Comando: `npx vitest run tests/unit/financeiro-import.test.ts`
Esperado: PASS (7 cases)

- [ ] **Step 5: Adiciona action `bulkImportExpensesAction` no fim de `src/lib/financeiro/actions.ts`**

```typescript
// adiciona ao topo do arquivo (junto aos outros imports)
import { parseBulkExpenses } from "./import";

// adiciona no fim do arquivo:
export async function bulkImportExpensesAction(formData: FormData) {
  const actor = await requireSocio();

  const text = String(formData.get("import_text") ?? "");
  if (!text.trim()) return { error: "Cole os dados antes de importar" };

  const parsed = parseBulkExpenses(text);
  if (parsed.rows.length === 0) {
    return { error: `Nenhuma linha válida (${parsed.errors.length} erro(s))` };
  }

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
  if (!org) return { error: "Organização não encontrada" };

  const payload = parsed.rows.map((r) => ({
    organization_id: org.id,
    descricao: r.descricao,
    categoria: r.categoria,
    tipo: r.tipo,
    valor: r.valor,
    mes_referencia: r.mes_referencia,
    inicio_mes: r.inicio_mes,
    fim_mes: r.fim_mes,
    notas: r.notas,
    criado_por: actor.id,
  }));

  const { data: inserted, error } = await supabase
    .from("expenses")
    .insert(payload)
    .select("id");
  if (error) return { error: error.message };

  await logAudit({
    entidade: "expenses",
    entidade_id: "bulk-import",
    acao: "create",
    dados_depois: { count: inserted?.length ?? 0, errors: parsed.errors.length } as Record<string, unknown>,
    ator_id: actor.id,
    justificativa: `Bulk import de ${inserted?.length ?? 0} despesa(s)`,
  });

  revalidateAll();
  return { success: true as const, count: inserted?.length ?? 0, errors: parsed.errors.length };
}
```

- [ ] **Step 6: Verifica typecheck + tests**

Comandos:
- `npx tsc --noEmit` — Esperado: EXIT=0
- `npx vitest run tests/unit/financeiro-import.test.ts tests/unit/financeiro-dre-calc.test.ts` — Esperado: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/financeiro/import.ts src/lib/financeiro/actions.ts tests/unit/financeiro-import.test.ts
git commit -m "feat(financeiro): bulk import via CSV/texto colado + parser com tests"
```

---

## Task 7: DRE components (DRELine, DREView, MesSelector, ViewModeToggle)

**Files:**
- Create: `src/components/financeiro/DRELine.tsx`
- Create: `src/components/financeiro/DREView.tsx`
- Create: `src/components/financeiro/MesSelector.tsx`
- Create: `src/components/financeiro/ViewModeToggle.tsx`

- [ ] **Step 1: Cria DRELine**

```tsx
// src/components/financeiro/DRELine.tsx
"use client";

import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  valor: number;
  /** Quando true, linha visualmente destacada (Receita, Lucro Bruto, Lucro Operacional) */
  emphasis?: boolean;
  /** Quando true, exibe o valor em negativo visual (despesa) */
  negative?: boolean;
  indent?: 0 | 1 | 2;
  margemPct?: number;
  /** Quando passado, aparece botão de override; chama callback com (id) */
  expenseId?: string;
  overrideAplicado?: boolean;
  onEditOverride?: (id: string) => void;
}

const BRL = (v: number) =>
  (v < 0 ? "-" : "") + Math.abs(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function DRELine({
  label, valor, emphasis = false, negative = false, indent = 0, margemPct,
  expenseId, overrideAplicado, onEditOverride,
}: Props) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 py-1.5 text-sm",
        emphasis && "border-t font-semibold",
        indent === 1 && "pl-4",
        indent === 2 && "pl-8 text-xs text-muted-foreground",
      )}
    >
      <span className="flex items-center gap-2">
        {negative && <span className="text-muted-foreground">(−)</span>}
        <span>{label}</span>
        {overrideAplicado && (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:text-amber-400">
            override
          </span>
        )}
      </span>
      <span className="flex items-center gap-2 tabular-nums">
        <span className={cn(negative && "text-rose-700 dark:text-rose-400")}>
          {negative ? `−${BRL(valor).replace("-", "")}` : BRL(valor)}
        </span>
        {margemPct !== undefined && (
          <span className="text-xs text-muted-foreground">
            ({margemPct.toFixed(1)}% margem)
          </span>
        )}
        {expenseId && onEditOverride && (
          <button
            type="button"
            onClick={() => onEditOverride(expenseId)}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Editar valor neste mês"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Cria DREView**

```tsx
// src/components/financeiro/DREView.tsx
"use client";

import { useMemo, useState } from "react";
import { DRELine } from "./DRELine";
import { OverrideDialog } from "./OverrideDialog";
import { CATEGORIA_LABEL, type ExpenseCategoria } from "@/lib/financeiro/schema";
import type { DREData, DRELine as DRELineData } from "@/lib/financeiro/queries";

const CATEGORIA_ORDER: ExpenseCategoria[] = [
  "aluguel", "software", "contabilidade", "impostos",
  "marketing_proprio", "equipamento", "pro_labore", "outros",
];

export function DREView({ data, prev }: { data: DREData; prev?: DREData | null }) {
  const [editingExpense, setEditingExpense] = useState<{ id: string; descricao: string; valorPadrao: number } | null>(null);

  const despesasPorCat = useMemo(() => {
    const m = new Map<ExpenseCategoria, DRELineData[]>();
    for (const d of data.despesas) {
      const arr = m.get(d.categoria) ?? [];
      arr.push(d);
      m.set(d.categoria, arr);
    }
    return m;
  }, [data.despesas]);

  function delta(curr: number, p: number | undefined): string | null {
    if (p === undefined) return null;
    const d = curr - p;
    if (d === 0) return "—";
    const sign = d > 0 ? "+" : "−";
    const abs = Math.abs(d).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const pct = p !== 0 ? ((d / Math.abs(p)) * 100).toFixed(1) : "—";
    return `${sign}${abs} (${pct}%)`;
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-1">
      <DRELine label="Receita Bruta" valor={data.receita_bruta} emphasis />
      {prev && (
        <p className="text-xs text-muted-foreground pl-4">vs mês anterior: {delta(data.receita_bruta, prev.receita_bruta)}</p>
      )}

      <DRELine label="Custo dos Serviços" valor={data.custo_servicos.total} negative />
      <DRELine label="Comissões" valor={data.custo_servicos.comissoes} indent={2} />
      <DRELine label="Tráfego pago (Google + Meta)" valor={data.custo_servicos.trafego} indent={2} />

      <DRELine label="= Lucro Bruto" valor={data.lucro_bruto} emphasis margemPct={data.margem_bruta_pct} />

      <DRELine label="Despesas Operacionais" valor={data.salarios + data.total_despesas} negative />
      <DRELine label="Salários fixos" valor={data.salarios} indent={2} />

      {CATEGORIA_ORDER.map((cat) => {
        const linhas = despesasPorCat.get(cat) ?? [];
        if (linhas.length === 0) return null;
        return linhas.map((d) => (
          <DRELine
            key={d.expenseId}
            label={d.descricao}
            valor={d.valor}
            indent={2}
            expenseId={d.expenseId}
            overrideAplicado={d.overrideAplicado}
            onEditOverride={(id) => setEditingExpense({ id, descricao: d.descricao, valorPadrao: d.valor })}
          />
        ));
      })}

      <DRELine
        label="= Lucro Operacional"
        valor={data.lucro_operacional}
        emphasis
        margemPct={data.margem_operacional_pct}
      />

      {editingExpense && (
        <OverrideDialog
          expenseId={editingExpense.id}
          descricao={editingExpense.descricao}
          mesRef={data.mesRef}
          valorAtual={editingExpense.valorPadrao}
          onClose={() => setEditingExpense(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Cria MesSelector**

```tsx
// src/components/financeiro/MesSelector.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MES_LABEL = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function shiftMes(mesRef: string, delta: number): string {
  const [y, m] = mesRef.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmt(mesRef: string): string {
  const [y, m] = mesRef.split("-").map(Number);
  return `${MES_LABEL[m - 1]}/${y}`;
}

export function MesSelector({ current }: { current: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function go(mes: string) {
    const sp = new URLSearchParams(params.toString());
    sp.set("mes", mes);
    router.push(`/financeiro?${sp.toString()}`);
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-md border bg-card">
      <button
        type="button"
        onClick={() => go(shiftMes(current, -1))}
        className="p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="px-2 text-sm font-medium tabular-nums">{fmt(current)}</span>
      <button
        type="button"
        onClick={() => go(shiftMes(current, 1))}
        className="p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Cria ViewModeToggle**

```tsx
// src/components/financeiro/ViewModeToggle.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

type Mode = "mes" | "6m" | "ytd";

const MODES: { key: Mode; label: string }[] = [
  { key: "mes", label: "Mês" },
  { key: "6m", label: "6 meses" },
  { key: "ytd", label: "YTD" },
];

export function ViewModeToggle({ current }: { current: Mode }) {
  const router = useRouter();
  const params = useSearchParams();

  function setMode(m: Mode) {
    const sp = new URLSearchParams(params.toString());
    if (m === "mes") sp.delete("mode");
    else sp.set("mode", m);
    router.push(`/financeiro?${sp.toString()}`);
  }

  return (
    <div className="inline-flex items-center rounded-md border bg-card p-0.5">
      {MODES.map((m) => (
        <button
          key={m.key}
          type="button"
          onClick={() => setMode(m.key)}
          className={cn(
            "rounded px-2.5 py-1 text-xs font-medium transition-colors",
            current === m.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Verifica typecheck**

Comando: `npx tsc --noEmit`
Esperado: EXIT=0 (TS pode reclamar de `OverrideDialog` ainda não criado — aceito, próxima task corrige)

- [ ] **Step 6: Commit (faz junto com OverrideDialog na próxima task)**

Esse step fica na task 8 — não commita ainda.

---

## Task 8: OverrideDialog + commit do bloco de DRE components

**Files:**
- Create: `src/components/financeiro/OverrideDialog.tsx`

- [ ] **Step 1: Cria OverrideDialog**

```tsx
// src/components/financeiro/OverrideDialog.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setOverrideAction, removeOverrideAction } from "@/lib/financeiro/actions";
import { Button } from "@/components/ui/button";

interface Props {
  expenseId: string;
  descricao: string;
  mesRef: string;
  valorAtual: number;
  onClose: () => void;
}

export function OverrideDialog({ expenseId, descricao, mesRef, valorAtual, onClose }: Props) {
  const router = useRouter();
  const [valor, setValor] = useState(String(valorAtual));
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    const fd = new FormData();
    fd.set("expense_id", expenseId);
    fd.set("mes_referencia", mesRef);
    fd.set("valor", valor);
    if (motivo.trim()) fd.set("motivo", motivo.trim());
    startTransition(async () => {
      const r = await setOverrideAction(fd);
      if (r && "error" in r && r.error) setError(r.error);
      else { onClose(); router.refresh(); }
    });
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const r = await removeOverrideAction(expenseId, mesRef);
      if (r && "error" in r && r.error) setError(r.error);
      else { onClose(); router.refresh(); }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-5 shadow-xl">
        <div>
          <h3 className="text-lg font-semibold">{descricao} — {mesRef}</h3>
          <p className="text-xs text-muted-foreground">Override só desse mês. Não afeta meses anteriores nem o valor padrão da despesa.</p>
        </div>

        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Valor neste mês</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            disabled={pending}
            className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Motivo (opcional)</span>
          <input
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            disabled={pending}
            placeholder="Ex.: aumento sazonal de luz"
            className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={handleRemove} disabled={pending}>
            Remover override
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verifica typecheck**

Comando: `npx tsc --noEmit`
Esperado: EXIT=0

- [ ] **Step 3: Commit**

```bash
git add src/components/financeiro/DRELine.tsx src/components/financeiro/DREView.tsx src/components/financeiro/MesSelector.tsx src/components/financeiro/ViewModeToggle.tsx src/components/financeiro/OverrideDialog.tsx
git commit -m "feat(financeiro): componentes do DRE (Line/View/MesSelector/ViewModeToggle/OverrideDialog)"
```

---

## Task 9: Página `/financeiro` (DRE)

**Files:**
- Create: `src/app/(authed)/financeiro/page.tsx`

- [ ] **Step 1: Cria a página**

```tsx
// src/app/(authed)/financeiro/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { getDRE, getDRESeries } from "@/lib/financeiro/queries";
import { DREView } from "@/components/financeiro/DREView";
import { MesSelector } from "@/components/financeiro/MesSelector";
import { ViewModeToggle } from "@/components/financeiro/ViewModeToggle";
import { Button } from "@/components/ui/button";

type Mode = "mes" | "6m" | "ytd";

function currentMesRef(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMes(mesRef: string, delta: number): string {
  const [y, m] = mesRef.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function isValidMes(s: string | undefined): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}$/.test(s);
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const user = await requireAuth();
  if (user.role !== "socio") redirect("/");

  const mesRef = isValidMes(params.mes) ? params.mes : currentMesRef();
  const mode: Mode = params.mode === "6m" ? "6m" : params.mode === "ytd" ? "ytd" : "mes";

  if (mode === "mes") {
    const [data, prev] = await Promise.all([
      getDRE(mesRef),
      getDRE(shiftMes(mesRef, -1)),
    ]);
    return (
      <Page mesRef={mesRef} mode={mode}>
        <DREView data={data} prev={prev} />
      </Page>
    );
  }

  if (mode === "6m") {
    const meses = Array.from({ length: 6 }, (_, i) => shiftMes(mesRef, -(5 - i)));
    const series = await getDRESeries(meses);
    return (
      <Page mesRef={mesRef} mode={mode}>
        <SeriesTable series={series} />
      </Page>
    );
  }

  // ytd
  const [year] = mesRef.split("-").map(Number);
  const ytdMeses = Array.from({ length: parseInt(mesRef.slice(5)) }, (_, i) =>
    `${year}-${String(i + 1).padStart(2, "0")}`,
  );
  const ytdSeries = await getDRESeries(ytdMeses);
  return (
    <Page mesRef={mesRef} mode={mode}>
      <SeriesTable series={ytdSeries} />
    </Page>
  );
}

function Page({ mesRef, mode, children }: { mesRef: string; mode: Mode; children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
          <p className="text-sm text-muted-foreground">DRE — visão de sócio</p>
        </div>
        <Link href="/financeiro/despesas">
          <Button variant="outline">Gerenciar despesas</Button>
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <MesSelector current={mesRef} />
        <ViewModeToggle current={mode} />
      </div>

      {children}
    </div>
  );
}

const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function SeriesTable({ series }: { series: import("@/lib/financeiro/queries").DREData[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr className="border-b">
            <th className="px-3 py-2 text-left font-medium">Linha</th>
            {series.map((s) => (
              <th key={s.mesRef} className="px-3 py-2 text-right font-medium">{s.mesRef}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <Row label="Receita Bruta" series={series} get={(d) => d.receita_bruta} bold />
          <Row label="(−) Comissões" series={series} get={(d) => d.custo_servicos.comissoes} />
          <Row label="(−) Tráfego pago" series={series} get={(d) => d.custo_servicos.trafego} />
          <Row label="= Lucro Bruto" series={series} get={(d) => d.lucro_bruto} bold />
          <Row label="(−) Salários" series={series} get={(d) => d.salarios} />
          <Row label="(−) Despesas oper." series={series} get={(d) => d.total_despesas} />
          <Row label="= Lucro Operacional" series={series} get={(d) => d.lucro_operacional} bold />
          <Row label="Margem operacional" series={series} get={(d) => d.margem_operacional_pct} pct />
        </tbody>
      </table>
    </div>
  );
}

function Row({
  label, series, get, bold, pct,
}: {
  label: string;
  series: import("@/lib/financeiro/queries").DREData[];
  get: (d: import("@/lib/financeiro/queries").DREData) => number;
  bold?: boolean;
  pct?: boolean;
}) {
  return (
    <tr className={bold ? "border-t font-semibold" : ""}>
      <td className="px-3 py-1.5">{label}</td>
      {series.map((d) => (
        <td key={d.mesRef} className="px-3 py-1.5 text-right tabular-nums">
          {pct ? `${get(d).toFixed(1)}%` : BRL(get(d))}
        </td>
      ))}
    </tr>
  );
}
```

- [ ] **Step 2: Verifica typecheck**

Comando: `npx tsc --noEmit`
Esperado: EXIT=0

- [ ] **Step 3: Commit**

```bash
git add "src/app/(authed)/financeiro/page.tsx"
git commit -m "feat(financeiro): página /financeiro com DRE (mês / 6m / YTD) — sócio only"
```

---

## Task 10: ExpenseForm + ExpenseTable + ExpenseFilters

**Files:**
- Create: `src/components/financeiro/ExpenseForm.tsx`
- Create: `src/components/financeiro/ExpenseTable.tsx`
- Create: `src/components/financeiro/ExpenseFilters.tsx`

- [ ] **Step 1: Cria ExpenseForm**

```tsx
// src/components/financeiro/ExpenseForm.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createExpenseAction, updateExpenseAction } from "@/lib/financeiro/actions";
import { EXPENSE_CATEGORIAS, CATEGORIA_LABEL, type ExpenseCategoria, type ExpenseTipo } from "@/lib/financeiro/schema";

interface Props {
  defaults?: {
    id?: string;
    descricao: string;
    categoria: ExpenseCategoria;
    tipo: ExpenseTipo;
    valor: number;
    mes_referencia: string | null;
    inicio_mes: string | null;
    fim_mes: string | null;
    notas: string | null;
  };
  onClose: () => void;
}

const monthNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export function ExpenseForm({ defaults, onClose }: Props) {
  const router = useRouter();
  const isEdit = !!defaults?.id;
  const [tipo, setTipo] = useState<ExpenseTipo>(defaults?.tipo ?? "fixa");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (defaults?.id) fd.set("id", defaults.id);
    startTransition(async () => {
      const r = isEdit
        ? await updateExpenseAction(fd)
        : await createExpenseAction(fd);
      if (r && "error" in r && r.error) setError(r.error);
      else { onClose(); router.refresh(); }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="text-xs text-muted-foreground">Tipo</label>
        <div className="mt-1 flex gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="tipo" value="fixa" checked={tipo === "fixa"} onChange={() => setTipo("fixa")} />
            Fixa mensal
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="tipo" value="avulsa" checked={tipo === "avulsa"} onChange={() => setTipo("avulsa")} />
            Avulsa (mês único)
          </label>
        </div>
      </div>

      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Descrição</span>
        <input
          name="descricao"
          required
          defaultValue={defaults?.descricao}
          className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Categoria</span>
        <select name="categoria" required defaultValue={defaults?.categoria ?? "outros"} className="w-full h-9 rounded-md border bg-card px-2 text-sm">
          {EXPENSE_CATEGORIAS.map((c) => (
            <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Valor (R$)</span>
        <input
          name="valor"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={defaults?.valor ?? 0}
          className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm tabular-nums"
        />
      </label>

      {tipo === "avulsa" && (
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Mês de referência</span>
          <input
            name="mes_referencia"
            type="month"
            required
            defaultValue={defaults?.mes_referencia ?? monthNow()}
            className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
          />
        </label>
      )}

      {tipo === "fixa" && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Início (opcional)</span>
            <input
              name="inicio_mes"
              type="month"
              defaultValue={defaults?.inicio_mes ?? ""}
              className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Fim (opcional)</span>
            <input
              name="fim_mes"
              type="month"
              defaultValue={defaults?.fim_mes ?? ""}
              className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
            />
          </label>
        </div>
      )}

      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Notas (opcional)</span>
        <textarea
          name="notas"
          rows={2}
          defaultValue={defaults?.notas ?? ""}
          className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
        />
      </label>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={pending}>Cancelar</Button>
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Salvando..." : (isEdit ? "Salvar" : "Criar")}</Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Cria ExpenseTable**

```tsx
// src/components/financeiro/ExpenseTable.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExpenseForm } from "./ExpenseForm";
import { CATEGORIA_LABEL } from "@/lib/financeiro/schema";
import { deactivateExpenseAction, deleteExpenseAction } from "@/lib/financeiro/actions";
import type { ExpenseListRow } from "@/lib/financeiro/queries";

const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ExpenseTable({ rows }: { rows: ExpenseListRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<ExpenseListRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ExpenseListRow | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [pending, startTransition] = useTransition();

  function deactivate(id: string) {
    if (!confirm("Marcar como desativada a partir do próximo mês?")) return;
    startTransition(async () => {
      await deactivateExpenseAction(id);
      router.refresh();
    });
  }

  function doDelete() {
    if (!confirmDelete) return;
    if (justificativa.trim().length < 3) return;
    const fd = new FormData();
    fd.set("id", confirmDelete.id);
    fd.set("justificativa", justificativa.trim());
    startTransition(async () => {
      const r = await deleteExpenseAction(fd);
      if (r && "error" in r && r.error) {
        alert(r.error);
        return;
      }
      setConfirmDelete(null);
      setJustificativa("");
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">Nenhuma despesa cadastrada.</p>;
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="border-b">
              <th className="px-3 py-2 text-left font-medium">Descrição</th>
              <th className="px-3 py-2 text-left font-medium">Categoria</th>
              <th className="px-3 py-2 text-left font-medium">Tipo</th>
              <th className="px-3 py-2 text-left font-medium">Vigência</th>
              <th className="px-3 py-2 text-right font-medium">Valor</th>
              <th className="px-3 py-2 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-muted/20">
                <td className="px-3 py-2">{r.descricao}</td>
                <td className="px-3 py-2 text-muted-foreground">{CATEGORIA_LABEL[r.categoria]}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.tipo === "fixa" ? "Fixa" : "Avulsa"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {r.tipo === "avulsa"
                    ? r.mes_referencia
                    : `${r.inicio_mes ?? "—"} → ${r.fim_mes ?? "ativa"}`}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{BRL(Number(r.valor))}</td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex gap-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(r)} title="Editar">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {r.tipo === "fixa" && !r.fim_mes && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => deactivate(r.id)} disabled={pending} title="Desativar">
                        Desativar
                      </Button>
                    )}
                    <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(r)} title="Excluir" className="text-destructive hover:text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border bg-card p-5 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">Editar despesa</h3>
            <ExpenseForm
              defaults={{
                id: editing.id,
                descricao: editing.descricao,
                categoria: editing.categoria,
                tipo: editing.tipo,
                valor: Number(editing.valor),
                mes_referencia: editing.mes_referencia,
                inicio_mes: editing.inicio_mes,
                fim_mes: editing.fim_mes,
                notas: editing.notas,
              }}
              onClose={() => setEditing(null)}
            />
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-xl border bg-card p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Excluir &ldquo;{confirmDelete.descricao}&rdquo;?</h3>
            <p className="text-xs text-destructive">
              Permanente. Histórico de overrides e DRE de meses passados podem mudar.
            </p>
            <input
              type="text"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Motivo (mín. 3 chars)"
              className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => { setConfirmDelete(null); setJustificativa(""); }} disabled={pending}>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={doDelete} disabled={pending || justificativa.trim().length < 3}>
                {pending ? "Excluindo..." : "Excluir"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Cria ExpenseFilters**

```tsx
// src/components/financeiro/ExpenseFilters.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { EXPENSE_CATEGORIAS, CATEGORIA_LABEL } from "@/lib/financeiro/schema";

export function ExpenseFilters() {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string | null) {
    const sp = new URLSearchParams(params.toString());
    if (!value || value === "qualquer") sp.delete(key);
    else sp.set(key, value);
    router.push(`/financeiro/despesas?${sp.toString()}`);
  }

  const tipo = params.get("tipo") ?? "qualquer";
  const categoria = params.get("categoria") ?? "qualquer";
  const mes = params.get("mes") ?? "";

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
      <label className="space-y-1">
        <span className="text-[11px] text-muted-foreground">Tipo</span>
        <select value={tipo} onChange={(e) => setParam("tipo", e.target.value)} className="h-8 w-32 rounded-md border bg-card px-2 text-sm">
          <option value="qualquer">Qualquer</option>
          <option value="fixa">Fixa</option>
          <option value="avulsa">Avulsa</option>
        </select>
      </label>

      <label className="space-y-1">
        <span className="text-[11px] text-muted-foreground">Categoria</span>
        <select value={categoria} onChange={(e) => setParam("categoria", e.target.value)} className="h-8 w-44 rounded-md border bg-card px-2 text-sm">
          <option value="qualquer">Qualquer</option>
          {EXPENSE_CATEGORIAS.map((c) => (
            <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>
          ))}
        </select>
      </label>

      {tipo === "avulsa" && (
        <label className="space-y-1">
          <span className="text-[11px] text-muted-foreground">Mês</span>
          <input
            type="month"
            value={mes}
            onChange={(e) => setParam("mes", e.target.value)}
            className="h-8 w-36 rounded-md border bg-card px-2 text-sm"
          />
        </label>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verifica typecheck**

Comando: `npx tsc --noEmit`
Esperado: EXIT=0

- [ ] **Step 5: Commit**

```bash
git add src/components/financeiro/ExpenseForm.tsx src/components/financeiro/ExpenseTable.tsx src/components/financeiro/ExpenseFilters.tsx
git commit -m "feat(financeiro): componentes de despesas (Form/Table/Filters)"
```

---

## Task 11: Página `/financeiro/despesas`

**Files:**
- Create: `src/app/(authed)/financeiro/despesas/page.tsx`

- [ ] **Step 1: Cria a página**

```tsx
// src/app/(authed)/financeiro/despesas/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExpenseForm } from "@/components/financeiro/ExpenseForm";

export default function DespesasClientShell({ children }: { children: React.ReactNode }) {
  const [adding, setAdding] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Despesas</h2>
          <p className="text-xs text-muted-foreground">Cadastro de despesas fixas e avulsas</p>
        </div>
        <div className="flex gap-2">
          <Link href="/financeiro/despesas/importar">
            <Button variant="outline">Importar em lote</Button>
          </Link>
          <Button onClick={() => setAdding(true)}>
            <Plus className="mr-2 h-4 w-4" />Nova despesa
          </Button>
        </div>
      </div>

      {children}

      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border bg-card p-5 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">Nova despesa</h3>
            <ExpenseForm onClose={() => setAdding(false)} />
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Cria o server wrapper na mesma pasta**

Renomeia o arquivo acima pra `_DespesasShell.tsx` e cria a página real:

```bash
mv "src/app/(authed)/financeiro/despesas/page.tsx" "src/app/(authed)/financeiro/despesas/_DespesasShell.tsx"
```

```tsx
// src/app/(authed)/financeiro/despesas/page.tsx
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { listExpenses } from "@/lib/financeiro/queries";
import { ExpenseTable } from "@/components/financeiro/ExpenseTable";
import { ExpenseFilters } from "@/components/financeiro/ExpenseFilters";
import DespesasShell from "./_DespesasShell";
import type { ExpenseCategoria, ExpenseTipo } from "@/lib/financeiro/schema";

interface SearchParams {
  tipo?: string;
  categoria?: string;
  mes?: string;
}

const TIPOS: ExpenseTipo[] = ["fixa", "avulsa"];

export default async function DespesasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireAuth();
  if (user.role !== "socio") redirect("/");

  const tipo = TIPOS.includes(params.tipo as ExpenseTipo) ? (params.tipo as ExpenseTipo) : undefined;
  const categoria = params.categoria && params.categoria !== "qualquer" ? (params.categoria as ExpenseCategoria) : undefined;
  const mes = params.mes && /^\d{4}-\d{2}$/.test(params.mes) ? params.mes : undefined;

  const rows = await listExpenses({ tipo, categoria, mes_referencia: mes });

  const fixas = rows.filter((r) => r.tipo === "fixa");
  const avulsas = rows.filter((r) => r.tipo === "avulsa");

  return (
    <div className="space-y-5">
      <DespesasShell>
        <ExpenseFilters />

        {(!tipo || tipo === "fixa") && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Fixas · {fixas.length}</h3>
            <ExpenseTable rows={fixas} />
          </section>
        )}

        {(!tipo || tipo === "avulsa") && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Avulsas · {avulsas.length}</h3>
            <ExpenseTable rows={avulsas} />
          </section>
        )}
      </DespesasShell>
    </div>
  );
}
```

- [ ] **Step 3: Verifica typecheck**

Comando: `npx tsc --noEmit`
Esperado: EXIT=0

- [ ] **Step 4: Commit**

```bash
git add "src/app/(authed)/financeiro/despesas/"
git commit -m "feat(financeiro): página /financeiro/despesas (CRUD + filtros)"
```

---

## Task 12: Bulk import — form + página

**Files:**
- Create: `src/components/financeiro/BulkExpenseImportForm.tsx`
- Create: `src/app/(authed)/financeiro/despesas/importar/page.tsx`

- [ ] **Step 1: Cria BulkExpenseImportForm**

```tsx
// src/components/financeiro/BulkExpenseImportForm.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { parseBulkExpenses, type ImportResult } from "@/lib/financeiro/import";
import { bulkImportExpensesAction } from "@/lib/financeiro/actions";

export function BulkExpenseImportForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onPreview() {
    setPreview(parseBulkExpenses(text));
    setError(null);
  }

  function onImport() {
    setError(null);
    const fd = new FormData();
    fd.set("import_text", text);
    startTransition(async () => {
      const r = await bulkImportExpensesAction(fd);
      if (r && "error" in r && r.error) {
        setError(r.error);
        return;
      }
      router.push("/financeiro/despesas");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="text-sm font-medium">Cole os dados abaixo</label>
        <p className="mt-1 mb-2 text-xs text-muted-foreground">
          Uma linha por despesa. Colunas separadas por TAB (do Excel/Sheets) ou vírgula. Ordem:
          {" "}<b>descricao | categoria | valor | tipo | mes_referencia | inicio_mes | fim_mes | notas</b>.
          {" "}Categorias: aluguel, software, contabilidade, impostos, marketing_proprio, equipamento, pro_labore, outros.
          {" "}Tipo: fixa ou avulsa. Cabeçalho opcional.
        </p>
        <textarea
          rows={12}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Aluguel,aluguel,5000,fixa\nSlack,software,200,fixa\niMac,equipamento,12000,avulsa,2026-05`}
          className="w-full rounded-md border border-input bg-card px-2 py-2 font-mono text-sm"
        />
        <Button type="button" variant="outline" onClick={onPreview} className="mt-3">
          Pré-visualizar
        </Button>
      </div>

      {preview && (
        <Card className="space-y-3 p-4">
          <div className="flex items-center gap-3 text-sm">
            {preview.rows.length > 0 && (
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> {preview.rows.length} válida(s)
              </span>
            )}
            {preview.errors.length > 0 && (
              <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400">
                <AlertTriangle className="h-4 w-4" /> {preview.errors.length} erro(s)
              </span>
            )}
          </div>

          {preview.errors.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <p className="mb-1 text-xs font-semibold text-destructive">Erros:</p>
              <ul className="space-y-1 text-xs text-destructive">
                {preview.errors.slice(0, 10).map((er, i) => (
                  <li key={i}>L{er.linha}: {er.mensagem} — <code className="text-[10px]">{er.raw}</code></li>
                ))}
                {preview.errors.length > 10 && <li>...e mais {preview.errors.length - 10}</li>}
              </ul>
            </div>
          )}

          {preview.rows.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-2 py-1 text-left">Descrição</th>
                    <th className="px-2 py-1 text-left">Categoria</th>
                    <th className="px-2 py-1 text-right">Valor</th>
                    <th className="px-2 py-1 text-left">Tipo</th>
                    <th className="px-2 py-1 text-left">Mês/Vigência</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 30).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1">{r.descricao}</td>
                      <td className="px-2 py-1">{r.categoria}</td>
                      <td className="px-2 py-1 text-right tabular-nums">R$ {r.valor.toLocaleString("pt-BR")}</td>
                      <td className="px-2 py-1">{r.tipo}</td>
                      <td className="px-2 py-1 text-muted-foreground">
                        {r.tipo === "avulsa" ? r.mes_referencia : `${r.inicio_mes ?? "—"} → ${r.fim_mes ?? "ativa"}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.rows.length > 30 && <p className="p-2 text-[11px] text-muted-foreground">...e mais {preview.rows.length - 30}</p>}
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end">
            <Button type="button" onClick={onImport} disabled={pending || preview.rows.length === 0}>
              {pending ? "Importando..." : `Importar ${preview.rows.length} linha(s)`}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Cria a página**

```tsx
// src/app/(authed)/financeiro/despesas/importar/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { BulkExpenseImportForm } from "@/components/financeiro/BulkExpenseImportForm";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default async function ImportarDespesasPage() {
  const user = await requireAuth();
  if (user.role !== "socio") redirect("/");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/financeiro/despesas">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="mr-1 h-4 w-4" />Voltar
          </Button>
        </Link>
      </div>
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Importar despesas em lote</h1>
        <p className="text-sm text-muted-foreground">CSV ou texto colado direto da planilha</p>
      </header>

      <BulkExpenseImportForm />
    </div>
  );
}
```

- [ ] **Step 3: Verifica typecheck**

Comando: `npx tsc --noEmit`
Esperado: EXIT=0

- [ ] **Step 4: Commit**

```bash
git add src/components/financeiro/BulkExpenseImportForm.tsx "src/app/(authed)/financeiro/despesas/importar/"
git commit -m "feat(financeiro): bulk import via /financeiro/despesas/importar (CSV/texto)"
```

---

## Task 13: Sidebar entry

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Adiciona o item "Financeiro" entre Comissões e Satisfação**

Edita o arquivo, na lista de imports adiciona `TrendingUp`:

```tsx
import {
  LayoutGrid, Users, Briefcase, KanbanSquare, ListChecks,
  DollarSign, Smile, Calendar, UserCog, Settings, ClipboardList, MessageSquare,
  TrendingUp,
} from "lucide-react";
```

E na constante `navItems`, insere entre o item de Comissões (`{ href: "/comissoes", ... }`) e o de Satisfação (`{ href: "/satisfacao", ... }`):

```tsx
{ href: "/financeiro", icon: TrendingUp, label: "Financeiro", roles: ["socio"], badgeKey: null },
```

- [ ] **Step 2: Verifica typecheck**

Comando: `npx tsc --noEmit`
Esperado: EXIT=0

- [ ] **Step 3: Smoke test mental**

Confere visualmente:
- Logado como sócio: vê "Financeiro" no sidebar
- Logado como adm/coord/comercial/etc: NÃO vê "Financeiro"
- Acessar `/financeiro` direto sem ser sócio → redirect pra `/`

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(financeiro): adiciona item 'Financeiro' no sidebar (sócio only)"
```

---

## Task 14: Verificação final + push + PR

**Files:**
- Nenhuma mudança de código.

- [ ] **Step 1: Roda typecheck final**

Comando: `npx tsc --noEmit`
Esperado: EXIT=0

- [ ] **Step 2: Roda todos os tests**

Comando: `npx vitest run 2>&1 | tail -5`
Esperado: tests passam (mesmas 7 falhas pré-existentes do baseline; novos do `financeiro-dre-calc.test.ts` e `financeiro-import.test.ts` passam)

- [ ] **Step 3: Push do branch**

```bash
git push -u origin claude/financeiro-dre
```

- [ ] **Step 4: Cria PR**

```bash
gh pr create --title "feat(financeiro): aba Financeiro com DRE + despesas + bulk import (sócio only)" --body "$(cat <<'EOF'
## Summary

Nova aba **Financeiro** no sidebar (visível só pra sócio), com:

- **`/financeiro`** — DRE mensal completo. Composição: Receita Bruta (clientes ativos comum) → (-) Comissões + Tráfego pago → Lucro Bruto (margem %) → (-) Salários (sem sócio) + Despesas operacionais por categoria → Lucro Operacional (margem %). Toggle entre **Mês** (com Δ vs anterior), **6 meses**, **YTD**.
- **`/financeiro/despesas`** — CRUD de despesas. Fixas (com vigência inicio/fim) + avulsas (mês específico). Editar inline, desativar fixa (seta fim_mes pro próximo mês), excluir com motivo obrigatório.
- **`/financeiro/despesas/importar`** — bulk import via CSV/texto. Preview com validação por linha. Importa em batch (transação simulada — todas válidas ou nenhuma; rejeita se 0 válidas).
- **Override de despesa fixa por mês**: botão ✎ na DRE abre dialog → salva valor diferente só naquele mês, não afeta outros meses nem o valor padrão.

## Implementação

- 2 tabelas novas: \`expenses\` + \`expense_overrides\` com RLS estrita (\`current_user_role() = 'socio'\`)
- 4 camadas de permissão: sidebar (\`roles: ['socio']\`), page (\`redirect\` se não sócio), action (\`requireSocio\` em todas), RLS (defesa em profundidade)
- Helpers puros (\`dre-calc.ts\`) com 11 unit tests
- Parser bulk (\`import.ts\`) com 7 unit tests
- 7 server actions: \`createExpense\`, \`updateExpense\`, \`deactivateExpense\`, \`deleteExpense\`, \`setOverride\`, \`removeOverride\`, \`bulkImportExpenses\`
- Cache: \`unstable_cache\` com tag \`'financeiro'\`, revalidate 300s; mutations invalidam tag
- Audit log em todas as mutations

## ⚠ Action needed após merge

A migration \`20260504000039_financeiro_expenses.sql\` precisa ser aplicada em prod via \`supabase db push\` ou cole o SQL no Dashboard SQL Editor. Sem isso, as queries vão falhar com "relation does not exist".

## Test plan

- [ ] Migration aplicada na prod
- [ ] Logado como sócio: vê item "Financeiro" no sidebar
- [ ] Logado como qualquer outra role: não vê o item, e \`/financeiro\` redireciona pra \`/\`
- [ ] DRE mostra Receita Bruta = soma de \`valor_mensal\` dos clientes comum ativos no mês
- [ ] DRE mostra Comissões = snapshot do mês (ou preview live se não tem snapshot)
- [ ] DRE mostra Tráfego = soma de \`valor_trafego_google + valor_trafego_meta\` dos clientes ativos
- [ ] DRE mostra Salários = soma de \`fixo_mensal\` dos profiles ativos (excluindo socio)
- [ ] Margem bruta e operacional aparecem como % ao lado dos lucros
- [ ] Toggle 6m mostra tabela com 6 colunas
- [ ] Toggle YTD mostra tabela com meses do ano até o atual
- [ ] Cadastrar despesa fixa em /financeiro/despesas → aparece no DRE do mês corrente
- [ ] Cadastrar despesa avulsa pra um mês específico → aparece só naquele mês
- [ ] Botão ✎ na linha de despesa do DRE → abre dialog → salvar valor diferente atualiza só aquele mês (DRE de outros meses não muda)
- [ ] Remover override volta o valor pro padrão
- [ ] Bulk import via /financeiro/despesas/importar valida e importa em lote
- [ ] Cabeçalho do CSV é detectado e ignorado
- [ ] Linhas inválidas no CSV aparecem com motivo, não bloqueiam as válidas
- [ ] Excluir despesa exige justificativa ≥3 chars
- [ ] Desativar fixa seta fim_mes pro próximo mês

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**1. Spec coverage:**
- Schema das 2 tabelas + RLS → Task 1 ✓
- Categorias canônicas → Task 2 ✓
- Helpers de cálculo (vigência, override, margem) → Task 3 ✓
- Queries (getDRE, getDRESeries, listExpenses, getExpenseById) → Task 4 ✓
- 7 server actions (CRUD + override + bulk) → Tasks 5, 6 ✓
- DRE components (5 componentes) → Tasks 7, 8 ✓
- Página DRE com Mês / 6m / YTD → Task 9 ✓
- Componentes de despesas (Form, Table, Filters) → Task 10 ✓
- Página de listagem CRUD → Task 11 ✓
- Bulk import (form + página) → Task 12 ✓
- Sidebar entry → Task 13 ✓
- Audit log → coberto em cada action que loga ✓
- Permissões em 4 camadas → coberto: sidebar (T13), page (T9, T11, T12), action (T5, T6), RLS (T1) ✓

**2. Placeholder scan:** Nenhum TBD/TODO. Todas as funções/tipos/sigs definidos antes de uso.

**3. Type consistency:**
- `ExpenseRow` (T3) e `ExpenseListRow extends ExpenseRow` (T4) — coerentes
- `DREData.despesas: DRELine[]` — `DRELine` definido em T4, consumido em T7/T9 ✓
- `ExpenseCategoria`/`ExpenseTipo` — definidos em T2, usados em T3, T4, T5, T6, T10 ✓
- `setOverrideAction` recebe \`expense_id\` (T5), \`OverrideDialog\` envia \`expense_id\` (T8) ✓
- `bulkImportExpensesAction` consome `parseBulkExpenses` (T6); `BulkExpenseImportForm` chama ambos (T12) ✓

**4. Migration apply:** Task 1 inclui passo explícito pra aplicar via SQL Editor — espelha o fluxo já usado no PR #58 deste projeto.
