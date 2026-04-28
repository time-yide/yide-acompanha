# Fase 7 — Comissões (Yide Digital) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sistema completo de comissões com snapshot mensal automático (cron Vercel slot 2), cálculo por papel (Assessor/Coord/Comercial/Audiovisual Chefe/Produtores/ADM), aprovação imutável pelo Sócio com ajuste manual + justificativa, e 3 sub-páginas (Minhas comissões com detalhamento de carteira, Visão geral, Fechamento).

**Architecture:** Função pura `calculateCommission(userId, monthRef)` produz `{ snapshot, items }` consumida pelo cron mensal (`generateMonthlySnapshots`) e pela página de previsão (`previewMyCommission`). Tabelas `commission_snapshots` (1 linha/user/mês) + `commission_snapshot_items` (detalhamento). Triggers da Fase 6 (`mes_aguardando_aprovacao` no cron, `mes_aprovado` na aprovação) reusam o `dispatchNotification` central.

**Tech Stack:** Next.js 16 + Supabase (Postgres + RLS) + Vercel Cron Hobby + Base UI + Tailwind + Zod + Vitest + Playwright. Sem dependências novas.

**Spec:** [docs/superpowers/specs/2026-04-27-fase-7-comissoes-design.md](../specs/2026-04-27-fase-7-comissoes-design.md)

**Plano anterior:** [Fase 6 — Notificações Completa](2026-04-27-fase-6-notificacoes.md)

**Fora do escopo:**
- Reabrir mês aprovado (decisão = imutável; correção via compensação no mês seguinte)
- Snapshot retroativo manual (só via cron)
- Comissão pro-rata em meio de mês
- Exportar PDF / contracheque → futuro
- Dashboard histórico de comissões → Fase 9
- Notificação de cliente perto do churn → Fase 8

**Pré-requisitos:**
- `CRON_SECRET` no Vercel (já configurado na Fase 6)
- Vercel Cron Hobby — slot 2 reservado pra esta fase

**Estado atual no repositório:**
- `src/lib/notificacoes/dispatch.ts` (Fase 6) com `dispatchNotification`
- Triggers `mes_aguardando_aprovacao` e `mes_aprovado` já estão na seed das `notification_rules`
- `vercel.json` tem 1 cron (`daily-digest`) — vamos adicionar slot 2
- Tabelas `clients` (com `valor_mensal`, `assessor_id`, `coordenador_id`, `status`), `leads` (com `valor_proposto`, `comercial_id`, `data_fechamento`, `client_id`), `profiles` (com `fixo_mensal`, `comissao_percent`, `comissao_primeiro_mes_percent`, `role`, `ativo`) — todas existem

**Estrutura final esperada:**

```
supabase/migrations/
└── 20260427000015_commission_snapshots.sql        [NEW]

src/
├── app/
│   ├── api/cron/monthly-snapshot/route.ts         [NEW]
│   └── (authed)/
│       └── comissoes/
│           ├── page.tsx                           [NEW — redirector]
│           ├── minhas/page.tsx                    [NEW]
│           ├── visao-geral/page.tsx               [NEW]
│           └── fechamento/page.tsx                [NEW]
│
├── components/
│   └── comissoes/
│       ├── CommissionTabs.tsx                     [NEW]
│       ├── CommissionBreakdown.tsx                [NEW — server, render por papel]
│       ├── PreviewCard.tsx                        [NEW]
│       ├── HistoryTable.tsx                       [NEW]
│       ├── SnapshotItemsDetail.tsx                [NEW]
│       ├── OverviewTable.tsx                      [NEW]
│       ├── FechamentoTable.tsx                    [NEW]
│       ├── AdjustmentModal.tsx                    [NEW — client]
│       └── ApproveMonthButton.tsx                 [NEW — client]
│
└── lib/comissoes/                                 [NEW dir]
    ├── schema.ts                                  [NEW — zod]
    ├── calculator.ts                              [NEW — fórmulas puras]
    ├── generator.ts                               [NEW — cron orchestrator]
    ├── preview.ts                                 [NEW — wrapper para mês corrente]
    ├── queries.ts                                 [NEW]
    └── actions.ts                                 [NEW — adjust + approve]

vercel.json                                        [MODIFY — adicionar slot 2]

tests/
├── unit/
│   ├── comissoes-calculator.test.ts               [NEW — 8 cases]
│   ├── comissoes-generator.test.ts                [NEW — 3 cases]
│   └── comissoes-actions.test.ts                  [NEW — 4 cases]
└── e2e/
    └── comissoes.spec.ts                          [NEW]
```

**Total estimado:** ~13 commits.

---

## Bloco A — Migration + Setup

### Task A1: Migration `commission_snapshots` + `commission_snapshot_items`

**Files:**
- Create: `supabase/migrations/20260427000015_commission_snapshots.sql`

- [ ] **Step A1.1: Escrever SQL**

```sql
-- supabase/migrations/20260427000015_commission_snapshots.sql

create type public.snapshot_status as enum ('pending_approval', 'aprovado');

create type public.snapshot_item_tipo as enum (
  'fixo',
  'carteira_assessor',
  'carteira_coord_agencia',
  'deal_fechado_comercial'
);

create table public.commission_snapshots (
  id uuid primary key default gen_random_uuid(),
  mes_referencia text not null,
  user_id uuid not null references public.profiles(id),
  papel_naquele_mes text not null,
  fixo numeric(12,2) not null default 0,
  percentual_aplicado numeric(5,2) not null default 0,
  base_calculo numeric(12,2) not null default 0,
  valor_variavel numeric(12,2) not null default 0,
  ajuste_manual numeric(12,2) not null default 0,
  valor_total numeric(12,2) not null default 0,
  status public.snapshot_status not null default 'pending_approval',
  aprovado_por uuid references public.profiles(id),
  aprovado_em timestamptz,
  justificativa_ajuste text,
  created_at timestamptz not null default now()
);

create unique index uq_commission_snapshots_user_mes
  on public.commission_snapshots(user_id, mes_referencia);

create index idx_commission_snapshots_mes_status
  on public.commission_snapshots(mes_referencia, status);

alter table public.commission_snapshots enable row level security;

create policy "users read own snapshots"
  on public.commission_snapshots for select to authenticated
  using (
    user_id = auth.uid()
    or public.current_user_role() in ('adm', 'socio')
  );

create policy "socio updates snapshots"
  on public.commission_snapshots for update to authenticated
  using (public.current_user_role() = 'socio')
  with check (public.current_user_role() = 'socio');

-- Insert/Delete sem policy: feitos via service-role no cron e em emergências.

create table public.commission_snapshot_items (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.commission_snapshots(id) on delete cascade,
  tipo public.snapshot_item_tipo not null,
  descricao text not null,
  base numeric(12,2) not null default 0,
  percentual numeric(5,2) not null default 0,
  valor numeric(12,2) not null default 0,
  client_id uuid references public.clients(id),
  lead_id uuid references public.leads(id),
  created_at timestamptz not null default now()
);

create index idx_commission_snapshot_items_snapshot
  on public.commission_snapshot_items(snapshot_id);

alter table public.commission_snapshot_items enable row level security;

create policy "items follow snapshot rls"
  on public.commission_snapshot_items for select to authenticated
  using (
    exists (
      select 1 from public.commission_snapshots cs
      where cs.id = snapshot_id
        and (cs.user_id = auth.uid() or public.current_user_role() in ('adm', 'socio'))
    )
  );
-- Insert/Update/Delete sem policy: via service-role.
```

- [ ] **Step A1.2: Aplicar e commit**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
SUPABASE_ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.env.local" | cut -d= -f2) \
  npx supabase db push
git add supabase/migrations/20260427000015_commission_snapshots.sql
git commit -m "feat(db): commission_snapshots and snapshot_items tables with RLS"
```

---

### Task A2: Regenerar tipos

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step A2.1: Regenerar**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
SUPABASE_ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.env.local" | cut -d= -f2) \
  SUPABASE_PROJECT_ID=jelvhwbpipawghwufpbc \
  npm run db:types
npm run typecheck
```

Esperar: `Database["public"]["Enums"]["snapshot_status"]` e `["snapshot_item_tipo"]` existem; `commission_snapshots` e `commission_snapshot_items` em `Tables`.

- [ ] **Step A2.2: Commit**

```bash
git add src/types/database.ts
git commit -m "chore(db): regenerate types after commission tables"
```

---

## Bloco B — Backend Core

### Task B1: `calculator.ts` — fórmulas puras (TDD)

**Files:**
- Create: `src/lib/comissoes/schema.ts`
- Create: `src/lib/comissoes/calculator.ts`
- Create: `tests/unit/comissoes-calculator.test.ts`

- [ ] **Step B1.1: Criar `schema.ts`**

```ts
import { z } from "zod";

export const adjustmentSchema = z.object({
  snapshot_id: z.string().uuid(),
  novo_valor_variavel: z.coerce.number().min(0, "Valor não pode ser negativo"),
  justificativa: z.string().min(5, "Justificativa muito curta (mín. 5 chars)"),
});

export const approveSchema = z.object({
  mes_referencia: z.string().regex(/^\d{4}-\d{2}$/, "Mês inválido (use formato YYYY-MM)"),
});

export type AdjustmentInput = z.infer<typeof adjustmentSchema>;
export type ApproveInput = z.infer<typeof approveSchema>;

export type SnapshotItemTipo =
  | "fixo"
  | "carteira_assessor"
  | "carteira_coord_agencia"
  | "deal_fechado_comercial";

export interface SnapshotCalc {
  fixo: number;
  percentual_aplicado: number;
  base_calculo: number;
  valor_variavel: number;
}

export interface SnapshotItem {
  tipo: SnapshotItemTipo;
  descricao: string;
  base: number;
  percentual: number;
  valor: number;
  client_id?: string;
  lead_id?: string;
}

export interface CommissionResult {
  snapshot: SnapshotCalc;
  items: SnapshotItem[];
}
```

- [ ] **Step B1.2: Escrever testes (TDD)**

Crie `tests/unit/comissoes-calculator.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

import { calculateCommission } from "@/lib/comissoes/calculator";

beforeEach(() => {
  fromMock.mockReset();
});

function mockProfile(profile: { id: string; role: string; fixo_mensal: number; comissao_percent: number; comissao_primeiro_mes_percent: number }) {
  return ({
    select: () => ({
      eq: () => ({
        single: vi.fn().mockResolvedValue({ data: profile }),
      }),
    }),
  });
}

function mockClientsQuery(rows: Array<{ valor_mensal: number; nome?: string; id?: string }>) {
  return ({
    select: () => ({
      eq: () => ({
        eq: vi.fn().mockResolvedValue({ data: rows }),
      }),
    }),
  });
}

function mockClientsAllAtivos(rows: Array<{ valor_mensal: number; nome?: string; id?: string }>) {
  return ({
    select: () => ({
      eq: vi.fn().mockResolvedValue({ data: rows }),
    }),
  });
}

function mockLeadsQuery(rows: Array<{ id: string; valor_proposto: number; client_id: string | null; cliente: { nome: string } | null }>) {
  return ({
    select: () => ({
      eq: () => ({
        gte: () => ({
          lte: vi.fn().mockResolvedValue({ data: rows }),
        }),
      }),
    }),
  });
}

describe("calculateCommission — Assessor", () => {
  it("calcula fixo + 5% de R$ 10.000 = R$ 500 variável", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return mockProfile({ id: "u1", role: "assessor", fixo_mensal: 3000, comissao_percent: 5, comissao_primeiro_mes_percent: 0 });
      }
      if (table === "clients") {
        return mockClientsQuery([{ valor_mensal: 6000, nome: "A" }, { valor_mensal: 4000, nome: "B" }]);
      }
      return {};
    });
    const r = await calculateCommission("u1", "2026-04");
    expect(r).not.toBeNull();
    expect(r!.snapshot.fixo).toBe(3000);
    expect(r!.snapshot.percentual_aplicado).toBe(5);
    expect(r!.snapshot.base_calculo).toBe(10000);
    expect(r!.snapshot.valor_variavel).toBe(500);
    expect(r!.items.length).toBe(2);
    expect(r!.items[0].tipo).toBe("fixo");
    expect(r!.items[1].tipo).toBe("carteira_assessor");
  });
});

describe("calculateCommission — Coordenador", () => {
  it("calcula fixo + 3% sobre carteira agência R$ 50.000 = R$ 1.500", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return mockProfile({ id: "u1", role: "coordenador", fixo_mensal: 5000, comissao_percent: 3, comissao_primeiro_mes_percent: 0 });
      }
      if (table === "clients") {
        return mockClientsAllAtivos([{ valor_mensal: 30000 }, { valor_mensal: 20000 }]);
      }
      return {};
    });
    const r = await calculateCommission("u1", "2026-04");
    expect(r!.snapshot.base_calculo).toBe(50000);
    expect(r!.snapshot.valor_variavel).toBe(1500);
    expect(r!.items[1].tipo).toBe("carteira_coord_agencia");
  });
});

describe("calculateCommission — Audiovisual Chefe (mesma fórmula de Coordenador)", () => {
  it("calcula 2% sobre carteira agência", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return mockProfile({ id: "u1", role: "audiovisual_chefe", fixo_mensal: 5000, comissao_percent: 2, comissao_primeiro_mes_percent: 0 });
      }
      if (table === "clients") {
        return mockClientsAllAtivos([{ valor_mensal: 50000 }]);
      }
      return {};
    });
    const r = await calculateCommission("u1", "2026-04");
    expect(r!.snapshot.valor_variavel).toBe(1000);
    expect(r!.items[1].tipo).toBe("carteira_coord_agencia");
  });
});

describe("calculateCommission — Comercial", () => {
  it("calcula 25% sobre 1º mês de cada deal fechado no mês", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return mockProfile({ id: "u1", role: "comercial", fixo_mensal: 4000, comissao_percent: 0, comissao_primeiro_mes_percent: 25 });
      }
      if (table === "leads") {
        return mockLeadsQuery([
          { id: "l1", valor_proposto: 4500, client_id: "c1", cliente: { nome: "Pizzaria Bella" } },
          { id: "l2", valor_proposto: 6200, client_id: "c2", cliente: { nome: "Restaurante Sabor" } },
        ]);
      }
      return {};
    });
    const r = await calculateCommission("u1", "2026-04");
    expect(r!.snapshot.valor_variavel).toBe(2675);
    expect(r!.items.length).toBe(3); // 1 fixo + 2 deals
    expect(r!.items[1].tipo).toBe("deal_fechado_comercial");
    expect(r!.items[1].valor).toBe(1125);
    expect(r!.items[2].valor).toBe(1550);
  });

  it("comercial sem deals: variável = 0, items = só fixo", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return mockProfile({ id: "u1", role: "comercial", fixo_mensal: 4000, comissao_percent: 0, comissao_primeiro_mes_percent: 25 });
      }
      if (table === "leads") {
        return mockLeadsQuery([]);
      }
      return {};
    });
    const r = await calculateCommission("u1", "2026-04");
    expect(r!.snapshot.valor_variavel).toBe(0);
    expect(r!.items.length).toBe(1);
    expect(r!.items[0].tipo).toBe("fixo");
  });
});

describe("calculateCommission — ADM e Produtores", () => {
  it("ADM: só fixo, 1 item", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return mockProfile({ id: "u1", role: "adm", fixo_mensal: 6000, comissao_percent: 0, comissao_primeiro_mes_percent: 0 });
      }
      return {};
    });
    const r = await calculateCommission("u1", "2026-04");
    expect(r!.snapshot.fixo).toBe(6000);
    expect(r!.snapshot.valor_variavel).toBe(0);
    expect(r!.items.length).toBe(1);
    expect(r!.items[0].tipo).toBe("fixo");
  });

  it("Videomaker: só fixo, 1 item", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return mockProfile({ id: "u1", role: "videomaker", fixo_mensal: 3000, comissao_percent: 0, comissao_primeiro_mes_percent: 0 });
      }
      return {};
    });
    const r = await calculateCommission("u1", "2026-04");
    expect(r!.snapshot.valor_variavel).toBe(0);
    expect(r!.items.length).toBe(1);
  });
});

describe("calculateCommission — Sócio retorna null", () => {
  it("não gera snapshot pra sócio", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return mockProfile({ id: "u1", role: "socio", fixo_mensal: 0, comissao_percent: 0, comissao_primeiro_mes_percent: 0 });
      }
      return {};
    });
    const r = await calculateCommission("u1", "2026-04");
    expect(r).toBeNull();
  });
});
```

- [ ] **Step B1.3: Rodar testes, esperar falhar**

```bash
npm run test -- tests/unit/comissoes-calculator.test.ts
```

- [ ] **Step B1.4: Criar `src/lib/comissoes/calculator.ts`**

```ts
// SERVER ONLY: do not import from client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { CommissionResult, SnapshotItem } from "./schema";

interface ProfileRow {
  id: string;
  role: string;
  fixo_mensal: number;
  comissao_percent: number;
  comissao_primeiro_mes_percent: number;
}

const MONEY = (n: number) => Math.round(n * 100) / 100;

export async function calculateCommission(
  userId: string,
  monthRef: string,
): Promise<CommissionResult | null> {
  const supabase = createServiceRoleClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, fixo_mensal, comissao_percent, comissao_primeiro_mes_percent")
    .eq("id", userId)
    .single();
  if (!profile) return null;
  const p = profile as unknown as ProfileRow;
  if (p.role === "socio") return null;

  const fixo = Number(p.fixo_mensal) || 0;
  const items: SnapshotItem[] = [
    { tipo: "fixo", descricao: "Fixo mensal", base: 0, percentual: 0, valor: fixo },
  ];

  if (p.role === "assessor") {
    const percentual = Number(p.comissao_percent) || 0;
    const { data: clientsRows } = await supabase
      .from("clients")
      .select("valor_mensal, nome, id")
      .eq("assessor_id", userId)
      .eq("status", "ativo");
    const rows = (clientsRows ?? []) as Array<{ valor_mensal: number; nome: string; id: string }>;
    const base = rows.reduce((sum, c) => sum + Number(c.valor_mensal || 0), 0);
    const valor_variavel = MONEY(base * percentual / 100);
    items.push({
      tipo: "carteira_assessor",
      descricao: `% sobre carteira (${rows.length} cliente${rows.length === 1 ? "" : "s"})`,
      base: MONEY(base),
      percentual,
      valor: valor_variavel,
    });
    return {
      snapshot: { fixo, percentual_aplicado: percentual, base_calculo: MONEY(base), valor_variavel },
      items,
    };
  }

  if (p.role === "coordenador" || p.role === "audiovisual_chefe") {
    const percentual = Number(p.comissao_percent) || 0;
    const { data: clientsRows } = await supabase
      .from("clients")
      .select("valor_mensal")
      .eq("status", "ativo");
    const rows = (clientsRows ?? []) as Array<{ valor_mensal: number }>;
    const base = rows.reduce((sum, c) => sum + Number(c.valor_mensal || 0), 0);
    const valor_variavel = MONEY(base * percentual / 100);
    items.push({
      tipo: "carteira_coord_agencia",
      descricao: `% sobre carteira da agência (${rows.length} cliente${rows.length === 1 ? "" : "s"})`,
      base: MONEY(base),
      percentual,
      valor: valor_variavel,
    });
    return {
      snapshot: { fixo, percentual_aplicado: percentual, base_calculo: MONEY(base), valor_variavel },
      items,
    };
  }

  if (p.role === "comercial") {
    const percentual = Number(p.comissao_primeiro_mes_percent) || 0;
    const [year, month] = monthRef.split("-").map(Number);
    const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDayDate = new Date(year, month, 0); // último dia do mês
    const lastDay = `${lastDayDate.getFullYear()}-${String(lastDayDate.getMonth() + 1).padStart(2, "0")}-${String(lastDayDate.getDate()).padStart(2, "0")}`;
    const { data: dealsRows } = await supabase
      .from("leads")
      .select("id, valor_proposto, client_id, cliente:clients(nome)")
      .eq("comercial_id", userId)
      .gte("data_fechamento", firstDay)
      .lte("data_fechamento", lastDay);
    const rows = (dealsRows ?? []) as Array<{ id: string; valor_proposto: number; client_id: string | null; cliente: { nome: string } | null }>;
    let base = 0;
    let valor_variavel = 0;
    for (const d of rows) {
      const v = Number(d.valor_proposto || 0);
      const comissao = MONEY(v * percentual / 100);
      base += v;
      valor_variavel += comissao;
      items.push({
        tipo: "deal_fechado_comercial",
        descricao: `${d.cliente?.nome ?? "Cliente"} — 1º mês R$ ${v.toFixed(2)}`,
        base: MONEY(v),
        percentual,
        valor: comissao,
        lead_id: d.id,
        client_id: d.client_id ?? undefined,
      });
    }
    return {
      snapshot: { fixo, percentual_aplicado: percentual, base_calculo: MONEY(base), valor_variavel: MONEY(valor_variavel) },
      items,
    };
  }

  // ADM, videomaker, designer, editor: só fixo
  return {
    snapshot: { fixo, percentual_aplicado: 0, base_calculo: 0, valor_variavel: 0 },
    items,
  };
}
```

- [ ] **Step B1.5: Rodar testes, esperar passar**

```bash
npm run test -- tests/unit/comissoes-calculator.test.ts
npm run typecheck
```

Esperar: 8/8 passa, typecheck clean.

- [ ] **Step B1.6: Commit**

```bash
git add src/lib/comissoes/schema.ts src/lib/comissoes/calculator.ts tests/unit/comissoes-calculator.test.ts
git commit -m "feat(comissoes): pure calculator with formulas per role and TDD"
```

---

### Task B2: `generator.ts` — cron orchestrator (TDD)

**Files:**
- Create: `src/lib/comissoes/generator.ts`
- Create: `tests/unit/comissoes-generator.test.ts`

- [ ] **Step B2.1: Escrever testes (TDD)**

Crie `tests/unit/comissoes-generator.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());
const calculateMock = vi.hoisted(() => vi.fn());
const dispatchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

vi.mock("@/lib/comissoes/calculator", () => ({
  calculateCommission: calculateMock,
}));

vi.mock("@/lib/notificacoes/dispatch", () => ({
  dispatchNotification: dispatchMock,
}));

import { generateMonthlySnapshots } from "@/lib/comissoes/generator";

beforeEach(() => {
  fromMock.mockReset();
  calculateMock.mockReset();
  dispatchMock.mockReset();
});

describe("generateMonthlySnapshots", () => {
  it("retorna skipped se já existe snapshot pro mês", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "commission_snapshots") {
        return {
          select: () => ({
            eq: () => ({
              limit: vi.fn().mockResolvedValue({ data: [{ id: "x" }] }),
            }),
          }),
        };
      }
      return {};
    });
    const r = await generateMonthlySnapshots("2026-04");
    expect(r).toEqual(expect.objectContaining({ skipped: true }));
    expect(calculateMock).not.toHaveBeenCalled();
  });

  it("skip Sócio e Inativos: query filtra antes de chamar calculator", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "commission_snapshots") {
        // Não há snapshot ainda; insert ok
        return {
          select: () => ({
            eq: () => ({
              limit: vi.fn().mockResolvedValue({ data: [] }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: vi.fn().mockResolvedValue({ data: { id: "snap1" } }),
            }),
          }),
        };
      }
      if (table === "commission_snapshot_items") {
        return { insert: vi.fn().mockResolvedValue({}) };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              neq: vi.fn().mockResolvedValue({ data: [{ id: "u1", role: "assessor" }] }),
            }),
          }),
        };
      }
      return {};
    });
    calculateMock.mockResolvedValue({
      snapshot: { fixo: 3000, percentual_aplicado: 5, base_calculo: 10000, valor_variavel: 500 },
      items: [{ tipo: "fixo", descricao: "Fixo", base: 0, percentual: 0, valor: 3000 }],
    });
    const r = await generateMonthlySnapshots("2026-04");
    expect(r).toEqual(expect.objectContaining({ count: 1 }));
    expect(calculateMock).toHaveBeenCalledTimes(1);
    expect(dispatchMock).toHaveBeenCalledTimes(1);
  });

  it("dispara mes_aguardando_aprovacao depois de inserir todos", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "commission_snapshots") {
        return {
          select: () => ({
            eq: () => ({
              limit: vi.fn().mockResolvedValue({ data: [] }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: vi.fn().mockResolvedValue({ data: { id: "snap1" } }),
            }),
          }),
        };
      }
      if (table === "commission_snapshot_items") {
        return { insert: vi.fn().mockResolvedValue({}) };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              neq: vi.fn().mockResolvedValue({ data: [] }),
            }),
          }),
        };
      }
      return {};
    });
    await generateMonthlySnapshots("2026-04");
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ evento_tipo: "mes_aguardando_aprovacao" }),
    );
  });
});
```

- [ ] **Step B2.2: Rodar testes, esperar falhar**

```bash
npm run test -- tests/unit/comissoes-generator.test.ts
```

- [ ] **Step B2.3: Criar `src/lib/comissoes/generator.ts`**

```ts
// SERVER ONLY: do not import from client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { calculateCommission } from "@/lib/comissoes/calculator";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";

type GenerateResult = { skipped: true; reason: string } | { count: number };

function formatMonth(monthRef: string): string {
  const [year, month] = monthRef.split("-");
  const names = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${names[Number(month) - 1]} ${year}`;
}

export async function generateMonthlySnapshots(monthRef: string): Promise<GenerateResult> {
  const supabase = createServiceRoleClient();

  // Idempotência
  const { data: existing } = await supabase
    .from("commission_snapshots")
    .select("id")
    .eq("mes_referencia", monthRef)
    .limit(1);
  if (existing && existing.length > 0) {
    return { skipped: true, reason: "already generated" };
  }

  // Lista colaboradores elegíveis
  const { data: profilesRows } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("ativo", true)
    .neq("role", "socio");
  const profiles = (profilesRows ?? []) as Array<{ id: string; role: string }>;

  let count = 0;
  for (const p of profiles) {
    const calc = await calculateCommission(p.id, monthRef);
    if (!calc) continue;

    const valor_total =
      Number(calc.snapshot.fixo) + Number(calc.snapshot.valor_variavel);

    const { data: snap } = await supabase
      .from("commission_snapshots")
      .insert({
        mes_referencia: monthRef,
        user_id: p.id,
        papel_naquele_mes: p.role,
        fixo: calc.snapshot.fixo,
        percentual_aplicado: calc.snapshot.percentual_aplicado,
        base_calculo: calc.snapshot.base_calculo,
        valor_variavel: calc.snapshot.valor_variavel,
        valor_total,
      })
      .select("id")
      .single();
    if (!snap) continue;

    if (calc.items.length > 0) {
      await supabase
        .from("commission_snapshot_items")
        .insert(
          calc.items.map((i) => ({
            snapshot_id: snap.id,
            tipo: i.tipo,
            descricao: i.descricao,
            base: i.base,
            percentual: i.percentual,
            valor: i.valor,
            client_id: i.client_id ?? null,
            lead_id: i.lead_id ?? null,
          })),
        );
    }
    count++;
  }

  await dispatchNotification({
    evento_tipo: "mes_aguardando_aprovacao",
    titulo: `Comissão de ${formatMonth(monthRef)} aguardando aprovação`,
    mensagem: `${count} snapshots gerados`,
    link: "/comissoes/fechamento",
  });

  return { count };
}
```

- [ ] **Step B2.4: Rodar testes, esperar passar**

```bash
npm run test -- tests/unit/comissoes-generator.test.ts
npm run typecheck
```

Esperar: 3/3 passam.

- [ ] **Step B2.5: Commit**

```bash
git add src/lib/comissoes/generator.ts tests/unit/comissoes-generator.test.ts
git commit -m "feat(comissoes): monthly snapshot generator with idempotency and notification"
```

---

### Task B3: Endpoint cron + vercel.json slot 2

**Files:**
- Create: `src/app/api/cron/monthly-snapshot/route.ts`
- Modify: `vercel.json`

- [ ] **Step B3.1: Criar endpoint**

```ts
import { NextResponse } from "next/server";
import { generateMonthlySnapshots } from "@/lib/comissoes/generator";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // mes_referencia = mês ANTERIOR (cron roda dia 1, gera referente ao mês que acabou)
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthRef = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  const result = await generateMonthlySnapshots(monthRef);
  return NextResponse.json(result);
}
```

- [ ] **Step B3.2: Atualizar `vercel.json`**

Substituir `vercel.json` inteiro:

```json
{
  "crons": [
    { "path": "/api/cron/daily-digest", "schedule": "0 11 * * *" },
    { "path": "/api/cron/monthly-snapshot", "schedule": "0 3 1 * *" }
  ]
}
```

`0 3 1 * *` = 03:00 UTC dia 1 = 00:00 BRT dia 1.

- [ ] **Step B3.3: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step B3.4: Commit**

```bash
git add src/app/api/cron/monthly-snapshot/route.ts vercel.json
git commit -m "feat(cron): monthly-snapshot endpoint with Vercel cron config (slot 2)"
```

---

### Task B4: `actions.ts` — adjust + approve (TDD)

**Files:**
- Create: `src/lib/comissoes/actions.ts`
- Create: `tests/unit/comissoes-actions.test.ts`

- [ ] **Step B4.1: Escrever testes (TDD)**

Crie `tests/unit/comissoes-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());
const requireAuthMock = vi.hoisted(() => vi.fn());
const logAuditMock = vi.hoisted(() => vi.fn());
const dispatchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromMock }),
}));

vi.mock("@/lib/auth/session", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/lib/audit/log", () => ({
  logAudit: logAuditMock,
}));

vi.mock("@/lib/notificacoes/dispatch", () => ({
  dispatchNotification: dispatchMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { adjustSnapshotAction, approveMonthAction } from "@/lib/comissoes/actions";

beforeEach(() => {
  fromMock.mockReset();
  requireAuthMock.mockReset();
  logAuditMock.mockReset();
  dispatchMock.mockReset();
  requireAuthMock.mockResolvedValue({ id: "socio-1", role: "socio", nome: "Sócio" });
});

describe("adjustSnapshotAction", () => {
  it("rejeita justificativa < 5 chars", async () => {
    const fd = new FormData();
    fd.set("snapshot_id", "00000000-0000-0000-0000-000000000000");
    fd.set("novo_valor_variavel", "100");
    fd.set("justificativa", "ok");
    const r = await adjustSnapshotAction(fd);
    expect(r).toEqual(expect.objectContaining({ error: expect.stringContaining("Justificativa") }));
  });

  it("rejeita snapshot já aprovado", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "commission_snapshots") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { id: "s1", status: "aprovado", fixo: 3000, valor_variavel: 500, ajuste_manual: 0 },
              }),
            }),
          }),
        };
      }
      return {};
    });
    const fd = new FormData();
    fd.set("snapshot_id", "00000000-0000-0000-0000-000000000000");
    fd.set("novo_valor_variavel", "600");
    fd.set("justificativa", "Bonus excepcional");
    const r = await adjustSnapshotAction(fd);
    expect(r).toEqual(expect.objectContaining({ error: expect.stringContaining("aprovado") }));
  });

  it("recalcula ajuste_manual e valor_total ao salvar", async () => {
    const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    fromMock.mockImplementation((table) => {
      if (table === "commission_snapshots") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { id: "s1", status: "pending_approval", fixo: 3000, valor_variavel: 500, ajuste_manual: 0 },
              }),
            }),
          }),
          update: updateMock,
        };
      }
      return {};
    });
    const fd = new FormData();
    fd.set("snapshot_id", "00000000-0000-0000-0000-000000000000");
    fd.set("novo_valor_variavel", "600");
    fd.set("justificativa", "Bonus excepcional");
    const r = await adjustSnapshotAction(fd);
    expect(r).toEqual({ success: true });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        valor_variavel: 600,
        ajuste_manual: 100,
        valor_total: 3600,
        justificativa_ajuste: "Bonus excepcional",
      }),
    );
    expect(logAuditMock).toHaveBeenCalled();
  });
});

describe("approveMonthAction", () => {
  it("rejeita se algum snapshot do mês tem valor_total < 0", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "commission_snapshots") {
        return {
          select: () => ({
            eq: () => ({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: "s1", user_id: "u1", valor_total: 500 },
                  { id: "s2", user_id: "u2", valor_total: -50 },
                ],
              }),
            }),
          }),
        };
      }
      return {};
    });
    const fd = new FormData();
    fd.set("mes_referencia", "2026-04");
    const r = await approveMonthAction(fd);
    expect(r).toEqual(expect.objectContaining({ error: expect.stringContaining("negativo") }));
  });
});
```

- [ ] **Step B4.2: Rodar testes, esperar falhar**

```bash
npm run test -- tests/unit/comissoes-actions.test.ts
```

- [ ] **Step B4.3: Criar `src/lib/comissoes/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { adjustmentSchema, approveSchema } from "./schema";

function formatMonth(monthRef: string): string {
  const [year, month] = monthRef.split("-");
  const names = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${names[Number(month) - 1]} ${year}`;
}

export async function adjustSnapshotAction(formData: FormData) {
  const actor = await requireAuth();
  if (actor.role !== "socio") return { error: "Apenas Sócio pode ajustar" };

  const parsed = adjustmentSchema.safeParse({
    snapshot_id: formData.get("snapshot_id"),
    novo_valor_variavel: formData.get("novo_valor_variavel"),
    justificativa: formData.get("justificativa"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("commission_snapshots")
    .select("*")
    .eq("id", parsed.data.snapshot_id)
    .single();
  if (!before) return { error: "Snapshot não encontrado" };
  if (before.status === "aprovado") return { error: "Mês já aprovado, não pode ajustar" };

  // Cálculo do delta:
  // - valor_calculado_original = valor_variavel - ajuste_manual_atual
  // - novo_ajuste = novo_valor_variavel - valor_calculado_original
  const valorCalculadoOriginal = Number(before.valor_variavel) - Number(before.ajuste_manual);
  const novoValorVariavel = parsed.data.novo_valor_variavel;
  const novoAjuste = Math.round((novoValorVariavel - valorCalculadoOriginal) * 100) / 100;
  const novoValorTotal = Math.round((Number(before.fixo) + novoValorVariavel) * 100) / 100;

  const { error } = await supabase
    .from("commission_snapshots")
    .update({
      valor_variavel: novoValorVariavel,
      ajuste_manual: novoAjuste,
      valor_total: novoValorTotal,
      justificativa_ajuste: novoAjuste === 0 ? null : parsed.data.justificativa,
    })
    .eq("id", parsed.data.snapshot_id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "commission_snapshots",
    entidade_id: parsed.data.snapshot_id,
    acao: "update",
    dados_antes: before as unknown as Record<string, unknown>,
    dados_depois: {
      valor_variavel: novoValorVariavel,
      ajuste_manual: novoAjuste,
      valor_total: novoValorTotal,
      justificativa_ajuste: parsed.data.justificativa,
    },
    ator_id: actor.id,
    justificativa: parsed.data.justificativa,
  });

  revalidatePath("/comissoes/fechamento");
  revalidatePath("/comissoes/visao-geral");
  return { success: true };
}

export async function approveMonthAction(formData: FormData) {
  const actor = await requireAuth();
  if (actor.role !== "socio") return { error: "Apenas Sócio pode aprovar" };

  const parsed = approveSchema.safeParse({ mes_referencia: formData.get("mes_referencia") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: snaps } = await supabase
    .from("commission_snapshots")
    .select("id, user_id, valor_total")
    .eq("mes_referencia", parsed.data.mes_referencia)
    .eq("status", "pending_approval");
  if (!snaps || snaps.length === 0) {
    return { error: "Nenhum snapshot pendente neste mês" };
  }

  if (snaps.some((s) => Number(s.valor_total) < 0)) {
    return { error: "Há snapshots com valor total negativo. Corrija antes de aprovar." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("commission_snapshots")
    .update({ status: "aprovado", aprovado_por: actor.id, aprovado_em: now })
    .eq("mes_referencia", parsed.data.mes_referencia)
    .eq("status", "pending_approval");
  if (error) return { error: error.message };

  await logAudit({
    entidade: "commission_snapshots",
    entidade_id: parsed.data.mes_referencia,
    acao: "approve",
    dados_depois: {
      status: "aprovado",
      aprovado_por: actor.id,
      aprovado_em: now,
      count: snaps.length,
    },
    ator_id: actor.id,
  });

  await dispatchNotification({
    evento_tipo: "mes_aprovado",
    titulo: `Comissão de ${formatMonth(parsed.data.mes_referencia)} aprovada`,
    mensagem: `Sua comissão deste mês foi aprovada. Valor disponível em /comissoes/minhas`,
    link: "/comissoes/minhas",
    user_ids_extras: snaps.map((s) => s.user_id),
    source_user_id: actor.id,
  });

  revalidatePath("/comissoes/fechamento");
  revalidatePath("/comissoes/visao-geral");
  revalidatePath("/comissoes/minhas");
  return { success: true, count: snaps.length };
}
```

- [ ] **Step B4.4: Rodar testes, esperar passar**

```bash
npm run test -- tests/unit/comissoes-actions.test.ts
npm run typecheck
```

- [ ] **Step B4.5: Commit**

```bash
git add src/lib/comissoes/actions.ts tests/unit/comissoes-actions.test.ts
git commit -m "feat(comissoes): adjust and approve actions with audit log and notifications"
```

---

## Bloco C — UI

### Task C1: Queries + `<CommissionBreakdown>` (component compartilhado)

**Files:**
- Create: `src/lib/comissoes/queries.ts`
- Create: `src/lib/comissoes/preview.ts`
- Create: `src/components/comissoes/CommissionBreakdown.tsx`

- [ ] **Step C1.1: Criar `queries.ts`**

```ts
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Status = Database["public"]["Enums"]["snapshot_status"];

export async function listSnapshotsForUser(userId: string, limit = 12) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("commission_snapshots")
    .select("*")
    .eq("user_id", userId)
    .order("mes_referencia", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getSnapshotById(id: string) {
  const supabase = await createClient();
  const { data: snap, error } = await supabase
    .from("commission_snapshots")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  const { data: items } = await supabase
    .from("commission_snapshot_items")
    .select("*")
    .eq("snapshot_id", id);
  return { snapshot: snap, items: items ?? [] };
}

export async function listSnapshotsForMonth(monthRef: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("commission_snapshots")
    .select("*, profile:profiles!commission_snapshots_user_id_fkey(id, nome, role, avatar_url)")
    .eq("mes_referencia", monthRef)
    .order("user_id");
  if (error) throw error;
  return data ?? [];
}

export async function getMonthsAwaitingApproval(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("commission_snapshots")
    .select("mes_referencia")
    .eq("status", "pending_approval" as Status);
  const set = new Set<string>();
  for (const r of (data ?? []) as Array<{ mes_referencia: string }>) {
    set.add(r.mes_referencia);
  }
  return [...set].sort();
}
```

- [ ] **Step C1.2: Criar `preview.ts`**

```ts
import { calculateCommission } from "./calculator";

export async function previewMyCommission(userId: string) {
  const now = new Date();
  const monthRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const result = await calculateCommission(userId, monthRef);
  return { monthRef, result };
}
```

- [ ] **Step C1.3: Criar `<CommissionBreakdown>`**

`src/components/comissoes/CommissionBreakdown.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";

interface BreakdownProps {
  papel: string;
  userId: string;
  monthRef: string;
  fixo: number;
  valor_variavel: number;
  base_calculo: number;
  percentual_aplicado: number;
}

function brl(n: number): string {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export async function CommissionBreakdown({
  papel,
  userId,
  monthRef,
  fixo,
  valor_variavel,
  base_calculo,
  percentual_aplicado,
}: BreakdownProps) {
  const supabase = await createClient();
  const total = Number(fixo) + Number(valor_variavel);

  if (papel === "assessor") {
    const { data: rows } = await supabase
      .from("clients")
      .select("id, nome, valor_mensal")
      .eq("assessor_id", userId)
      .eq("status", "ativo")
      .order("nome");
    const list = (rows ?? []) as Array<{ id: string; nome: string; valor_mensal: number }>;
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold mb-2">Sua carteira ({list.length} cliente{list.length === 1 ? "" : "s"})</h3>
          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{c.nome}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{brl(Number(c.valor_mensal))}</td>
                  </tr>
                ))}
                <tr className="bg-muted/40 font-semibold">
                  <td className="px-3 py-2">Total carteira</td>
                  <td className="px-3 py-2 text-right tabular-nums">{brl(base_calculo)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <CalculoSummary fixo={fixo} variavel={valor_variavel} percentual={percentual_aplicado} total={total} variavelLabel={`Variável (${percentual_aplicado}%)`} />
      </div>
    );
  }

  if (papel === "coordenador" || papel === "audiovisual_chefe") {
    const { data: rows } = await supabase
      .from("clients")
      .select("id, nome, valor_mensal")
      .eq("status", "ativo")
      .order("nome");
    const list = (rows ?? []) as Array<{ id: string; nome: string; valor_mensal: number }>;
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold mb-2">Carteira da agência ({list.length} clientes)</h3>
          <div className="rounded-lg border bg-card overflow-hidden max-h-[300px] overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{c.nome}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{brl(Number(c.valor_mensal))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-b-lg border-t bg-muted/40 px-3 py-2 text-sm font-semibold flex justify-between">
            <span>Total agência</span>
            <span className="tabular-nums">{brl(base_calculo)}</span>
          </div>
        </div>
        <CalculoSummary fixo={fixo} variavel={valor_variavel} percentual={percentual_aplicado} total={total} variavelLabel={`Variável (${percentual_aplicado}%)`} />
      </div>
    );
  }

  if (papel === "comercial") {
    const [year, month] = monthRef.split("-").map(Number);
    const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDate = new Date(year, month, 0);
    const lastDay = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, "0")}-${String(lastDate.getDate()).padStart(2, "0")}`;
    const { data: deals } = await supabase
      .from("leads")
      .select("id, valor_proposto, cliente:clients(nome)")
      .eq("comercial_id", userId)
      .gte("data_fechamento", firstDay)
      .lte("data_fechamento", lastDay);
    const list = (deals ?? []) as Array<{ id: string; valor_proposto: number; cliente: { nome: string } | null }>;
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold mb-2">Deals fechados ({list.length})</h3>
          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Cliente</th>
                  <th className="px-3 py-2 text-right font-medium">1º mês</th>
                  <th className="px-3 py-2 text-right font-medium">%</th>
                  <th className="px-3 py-2 text-right font-medium">Comissão</th>
                </tr>
              </thead>
              <tbody>
                {list.map((d) => {
                  const v = Number(d.valor_proposto);
                  const c = Math.round(v * percentual_aplicado / 100 * 100) / 100;
                  return (
                    <tr key={d.id} className="border-t">
                      <td className="px-3 py-2">{d.cliente?.nome ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{brl(v)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{percentual_aplicado}%</td>
                      <td className="px-3 py-2 text-right tabular-nums">{brl(c)}</td>
                    </tr>
                  );
                })}
                <tr className="bg-muted/40 font-semibold">
                  <td className="px-3 py-2" colSpan={3}>Total deals</td>
                  <td className="px-3 py-2 text-right tabular-nums">{brl(valor_variavel)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <CalculoSummary fixo={fixo} variavel={valor_variavel} percentual={percentual_aplicado} total={total} variavelLabel="Variável (Σ deals)" />
      </div>
    );
  }

  // ADM, videomaker, designer, editor
  return (
    <div className="space-y-4">
      <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        Você recebe apenas o fixo mensal.
      </p>
      <CalculoSummary fixo={fixo} variavel={0} percentual={0} total={total} variavelLabel="Variável" hideVariavel />
    </div>
  );
}

function CalculoSummary({
  fixo,
  variavel,
  total,
  variavelLabel,
  hideVariavel = false,
}: {
  fixo: number;
  variavel: number;
  percentual: number;
  total: number;
  variavelLabel: string;
  hideVariavel?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2 text-sm">
      <div className="flex justify-between">
        <span>Fixo:</span>
        <span className="tabular-nums">{brl(fixo)}</span>
      </div>
      {!hideVariavel && (
        <div className="flex justify-between">
          <span>{variavelLabel}:</span>
          <span className="tabular-nums">{brl(variavel)}</span>
        </div>
      )}
      <hr className="border-border" />
      <div className="flex justify-between font-semibold text-base">
        <span>Salário previsto:</span>
        <span className="tabular-nums">{brl(total)}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step C1.4: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step C1.5: Commit**

```bash
git add src/lib/comissoes/queries.ts src/lib/comissoes/preview.ts src/components/comissoes/CommissionBreakdown.tsx
git commit -m "feat(comissoes): queries, preview helper and reusable CommissionBreakdown component"
```

---

### Task C2: Página `/comissoes/minhas`

**Files:**
- Create: `src/app/(authed)/comissoes/page.tsx` (redirector)
- Create: `src/app/(authed)/comissoes/minhas/page.tsx`
- Create: `src/components/comissoes/CommissionTabs.tsx`
- Create: `src/components/comissoes/HistoryTable.tsx`

- [ ] **Step C2.1: Criar `<CommissionTabs>`**

```tsx
import Link from "next/link";

interface Tab { slug: string; label: string; href: string; }

interface Props {
  active: "minhas" | "visao-geral" | "fechamento";
  showVisaoGeral: boolean;
  showFechamento: boolean;
  pendingMesesCount: number;
}

export function CommissionTabs({ active, showVisaoGeral, showFechamento, pendingMesesCount }: Props) {
  const tabs: Tab[] = [];
  if (showVisaoGeral) tabs.push({ slug: "visao-geral", label: "Visão geral", href: "/comissoes/visao-geral" });
  tabs.push({ slug: "minhas", label: "Minhas comissões", href: "/comissoes/minhas" });
  if (showFechamento) tabs.push({ slug: "fechamento", label: "Fechamento", href: "/comissoes/fechamento" });

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {tabs.map((t, i) => (
        <span key={t.slug} className="flex items-center gap-3">
          <Link
            href={t.href}
            className={active === t.slug
              ? "font-semibold text-primary"
              : "text-muted-foreground hover:text-foreground"}
          >
            {t.label}
            {t.slug === "fechamento" && pendingMesesCount > 0 && (
              <span className="ml-2 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
                {pendingMesesCount}
              </span>
            )}
          </Link>
          {i < tabs.length - 1 && <span className="text-muted-foreground">·</span>}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step C2.2: Criar `<HistoryTable>`**

```tsx
import Link from "next/link";

function brl(n: number): string {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatMonth(monthRef: string): string {
  const [year, month] = monthRef.split("-");
  const names = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ];
  return `${names[Number(month) - 1]}/${year}`;
}

interface Snapshot {
  id: string;
  mes_referencia: string;
  fixo: number;
  valor_variavel: number;
  ajuste_manual: number;
  valor_total: number;
  status: string;
}

export function HistoryTable({ snapshots }: { snapshots: Snapshot[] }) {
  if (snapshots.length === 0) {
    return (
      <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
        Sem histórico de snapshots. O primeiro será gerado em 1º do próximo mês.
      </p>
    );
  }
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Mês</th>
            <th className="px-3 py-2 text-right font-medium">Fixo</th>
            <th className="px-3 py-2 text-right font-medium">Variável</th>
            <th className="px-3 py-2 text-right font-medium">Ajuste</th>
            <th className="px-3 py-2 text-right font-medium">Total</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {snapshots.map((s) => (
            <tr key={s.id} className="border-t">
              <td className="px-3 py-2">
                <Link href={`/comissoes/snapshot/${s.id}`} className="hover:underline">
                  {formatMonth(s.mes_referencia)}
                </Link>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{brl(Number(s.fixo))}</td>
              <td className="px-3 py-2 text-right tabular-nums">{brl(Number(s.valor_variavel))}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {Number(s.ajuste_manual) !== 0 ? brl(Number(s.ajuste_manual)) : "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-medium">{brl(Number(s.valor_total))}</td>
              <td className="px-3 py-2">
                {s.status === "aprovado" ? (
                  <span className="inline-flex rounded-full border border-green-500/40 bg-green-500/10 px-2 py-0.5 text-[11px] text-green-600 dark:text-green-400">
                    Aprovado
                  </span>
                ) : (
                  <span className="inline-flex rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-600 dark:text-amber-400">
                    Aguardando
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step C2.3: Criar `/comissoes/page.tsx` (redirector)**

```tsx
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";

export default async function ComissoesIndexPage() {
  const user = await requireAuth();
  if (user.role === "socio") redirect("/comissoes/visao-geral");
  redirect("/comissoes/minhas");
}
```

- [ ] **Step C2.4: Criar `/comissoes/minhas/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { CommissionTabs } from "@/components/comissoes/CommissionTabs";
import { CommissionBreakdown } from "@/components/comissoes/CommissionBreakdown";
import { HistoryTable } from "@/components/comissoes/HistoryTable";
import { listSnapshotsForUser, getMonthsAwaitingApproval } from "@/lib/comissoes/queries";
import { previewMyCommission } from "@/lib/comissoes/preview";
import { Card } from "@/components/ui/card";

function formatMonthLong(monthRef: string): string {
  const [year, month] = monthRef.split("-");
  const names = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${names[Number(month) - 1]} de ${year}`;
}

export default async function MinhasComissoesPage() {
  const user = await requireAuth();
  if (user.role === "socio") redirect("/comissoes/visao-geral");

  const { monthRef, result } = await previewMyCommission(user.id);
  const snapshots = await listSnapshotsForUser(user.id);
  const showVisaoGeral = canAccess(user.role, "view:other_commissions");
  const showFechamento = canAccess(user.role, "approve:monthly_closing");
  const pending = await getMonthsAwaitingApproval();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Comissões</h1>
        <p className="text-sm text-muted-foreground">
          Sua previsão atual e histórico dos últimos 12 meses.
        </p>
      </header>

      <CommissionTabs
        active="minhas"
        showVisaoGeral={showVisaoGeral}
        showFechamento={showFechamento}
        pendingMesesCount={pending.length}
      />

      <Card className="p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Previsão de {formatMonthLong(monthRef)}</h2>
          <p className="text-xs text-muted-foreground">
            Esta é uma previsão. O snapshot oficial é gerado em 1º do próximo mês.
          </p>
        </div>
        {result && (
          <CommissionBreakdown
            papel={user.role}
            userId={user.id}
            monthRef={monthRef}
            fixo={result.snapshot.fixo}
            valor_variavel={result.snapshot.valor_variavel}
            base_calculo={result.snapshot.base_calculo}
            percentual_aplicado={result.snapshot.percentual_aplicado}
          />
        )}
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Histórico</h2>
        <HistoryTable snapshots={snapshots} />
      </section>
    </div>
  );
}
```

- [ ] **Step C2.5: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step C2.6: Commit**

```bash
git add src/components/comissoes/CommissionTabs.tsx \
  src/components/comissoes/HistoryTable.tsx \
  "src/app/(authed)/comissoes/page.tsx" \
  "src/app/(authed)/comissoes/minhas/page.tsx"
git commit -m "feat(comissoes): /comissoes/minhas page with breakdown and history"
```

---

### Task C3: Página `/comissoes/visao-geral` + `<OverviewTable>`

**Files:**
- Create: `src/app/(authed)/comissoes/visao-geral/page.tsx`
- Create: `src/components/comissoes/OverviewTable.tsx`

- [ ] **Step C3.1: Criar `<OverviewTable>`**

```tsx
function brl(n: number): string {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const roleLabels: Record<string, string> = {
  adm: "ADM",
  socio: "Sócio",
  comercial: "Comercial",
  coordenador: "Coordenador",
  assessor: "Assessor",
  videomaker: "Videomaker",
  designer: "Designer",
  editor: "Editor",
  audiovisual_chefe: "Audiovisual Chefe",
};

interface Row {
  id: string;
  fixo: number;
  valor_variavel: number;
  ajuste_manual: number;
  valor_total: number;
  status: string;
  papel_naquele_mes: string;
  profile: { id: string; nome: string; role: string } | null;
}

export function OverviewTable({ rows }: { rows: Row[] }) {
  const totalGeral = rows.reduce((s, r) => s + Number(r.valor_total), 0);
  const aprovados = rows.filter((r) => r.status === "aprovado").length;
  const pendentes = rows.filter((r) => r.status === "pending_approval").length;

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
        Nenhum snapshot neste mês.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        {rows.length} colaboradores · {aprovados} aprovados · {pendentes} pendentes
      </div>
      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Colaborador</th>
              <th className="px-3 py-2 text-left font-medium">Papel</th>
              <th className="px-3 py-2 text-right font-medium">Fixo</th>
              <th className="px-3 py-2 text-right font-medium">Variável</th>
              <th className="px-3 py-2 text-right font-medium">Ajuste</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{r.profile?.nome ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {roleLabels[r.papel_naquele_mes] ?? r.papel_naquele_mes}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{brl(Number(r.fixo))}</td>
                <td className="px-3 py-2 text-right tabular-nums">{brl(Number(r.valor_variavel))}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {Number(r.ajuste_manual) !== 0 ? brl(Number(r.ajuste_manual)) : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{brl(Number(r.valor_total))}</td>
                <td className="px-3 py-2">
                  {r.status === "aprovado" ? (
                    <span className="inline-flex rounded-full border border-green-500/40 bg-green-500/10 px-2 py-0.5 text-[11px] text-green-600 dark:text-green-400">
                      Aprovado
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-600 dark:text-amber-400">
                      Aguardando
                    </span>
                  )}
                </td>
              </tr>
            ))}
            <tr className="bg-muted/40 font-semibold">
              <td colSpan={5} className="px-3 py-2">Total geral (custo da agência no mês)</td>
              <td className="px-3 py-2 text-right tabular-nums">{brl(totalGeral)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step C3.2: Criar `/comissoes/visao-geral/page.tsx`**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { CommissionTabs } from "@/components/comissoes/CommissionTabs";
import { OverviewTable } from "@/components/comissoes/OverviewTable";
import { listSnapshotsForMonth, getMonthsAwaitingApproval } from "@/lib/comissoes/queries";

function defaultMonth(): string {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLong(monthRef: string): string {
  const [year, month] = monthRef.split("-");
  const names = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${names[Number(month) - 1]} de ${year}`;
}

export default async function VisaoGeralPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const params = await searchParams;
  const user = await requireAuth();
  if (!canAccess(user.role, "view:other_commissions")) notFound();

  const showFechamento = canAccess(user.role, "approve:monthly_closing");
  const pending = await getMonthsAwaitingApproval();
  const monthRef = params.mes && /^\d{4}-\d{2}$/.test(params.mes) ? params.mes : defaultMonth();
  const rows = await listSnapshotsForMonth(monthRef);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Comissões</h1>
        <p className="text-sm text-muted-foreground">
          Visão consolidada de todos os colaboradores.
        </p>
      </header>

      <CommissionTabs
        active="visao-geral"
        showVisaoGeral={true}
        showFechamento={showFechamento}
        pendingMesesCount={pending.length}
      />

      {pending.length > 0 && showFechamento && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          ⚠ {pending.length} mês{pending.length === 1 ? "" : "es"} aguardando aprovação:{" "}
          <Link href="/comissoes/fechamento" className="text-primary hover:underline font-medium">
            ir para Fechamento →
          </Link>
        </div>
      )}

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Mês:</span>
        <span className="text-sm">{formatMonthLong(monthRef)}</span>
      </div>

      <OverviewTable rows={rows as unknown as Parameters<typeof OverviewTable>[0]["rows"]} />
    </div>
  );
}
```

- [ ] **Step C3.3: Typecheck + commit**

```bash
npm run typecheck
git add src/components/comissoes/OverviewTable.tsx \
  "src/app/(authed)/comissoes/visao-geral/page.tsx"
git commit -m "feat(comissoes): /comissoes/visao-geral page with monthly overview"
```

---

### Task C4: Página `/comissoes/fechamento` + componentes de ajuste/aprovação

**Files:**
- Create: `src/components/comissoes/AdjustmentModal.tsx` (client)
- Create: `src/components/comissoes/ApproveMonthButton.tsx` (client)
- Create: `src/components/comissoes/FechamentoTable.tsx`
- Create: `src/app/(authed)/comissoes/fechamento/page.tsx`

- [ ] **Step C4.1: Criar `<AdjustmentModal>` (client)**

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adjustSnapshotAction } from "@/lib/comissoes/actions";

interface Props {
  snapshotId: string;
  currentValor: number;
  collaboratorName: string;
  onClose: () => void;
}

export function AdjustmentModal({ snapshotId, currentValor, collaboratorName, onClose }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [novoValor, setNovoValor] = useState(String(currentValor));
  const [justificativa, setJustificativa] = useState("");

  function submit() {
    setError(null);
    if (justificativa.length < 5) {
      setError("Justificativa muito curta (mín. 5 chars)");
      return;
    }
    const fd = new FormData();
    fd.set("snapshot_id", snapshotId);
    fd.set("novo_valor_variavel", novoValor);
    fd.set("justificativa", justificativa);
    startTransition(async () => {
      const result = await adjustSnapshotAction(fd);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card rounded-lg border w-[90%] max-w-md p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">Ajustar comissão de {collaboratorName}</h3>

        <div className="space-y-2">
          <Label htmlFor="novo-valor">Novo valor variável (R$)</Label>
          <Input
            id="novo-valor"
            type="number"
            step="0.01"
            min="0"
            value={novoValor}
            onChange={(e) => setNovoValor(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="justificativa">Justificativa (obrigatório, mín. 5 chars)</Label>
          <Input
            id="justificativa"
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            placeholder="Ex.: Bônus excepcional aprovado em reunião"
          />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Salvando..." : "Salvar ajuste"}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step C4.2: Criar `<ApproveMonthButton>` (client)**

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { approveMonthAction } from "@/lib/comissoes/actions";

interface Props {
  monthRef: string;
  monthLabel: string;
  count: number;
  hasNegative: boolean;
}

export function ApproveMonthButton({ monthRef, monthLabel, count, hasNegative }: Props) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setError(null);
    const fd = new FormData();
    fd.set("mes_referencia", monthRef);
    startTransition(async () => {
      const result = await approveMonthAction(fd);
      if (result && "error" in result) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      setConfirming(false);
    });
  }

  if (hasNegative) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        Há snapshots com valor total negativo. Corrija antes de aprovar.
      </div>
    );
  }

  return (
    <div>
      {confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-sm">Aprovar todos os {count} snapshots de {monthLabel}?</span>
          <Button onClick={confirm} disabled={pending}>
            {pending ? "Aprovando..." : "Sim, aprovar"}
          </Button>
          <Button variant="outline" onClick={() => setConfirming(false)} disabled={pending}>
            Cancelar
          </Button>
        </div>
      ) : (
        <Button size="lg" onClick={() => setConfirming(true)}>
          Aprovar mês de {monthLabel}
        </Button>
      )}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
```

- [ ] **Step C4.3: Criar `<FechamentoTable>`**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AdjustmentModal } from "./AdjustmentModal";

function brl(n: number): string {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const roleLabels: Record<string, string> = {
  adm: "ADM",
  comercial: "Comercial",
  coordenador: "Coordenador",
  assessor: "Assessor",
  videomaker: "Videomaker",
  designer: "Designer",
  editor: "Editor",
  audiovisual_chefe: "Audiovisual Chefe",
};

interface Row {
  id: string;
  fixo: number;
  valor_variavel: number;
  ajuste_manual: number;
  valor_total: number;
  status: string;
  papel_naquele_mes: string;
  justificativa_ajuste: string | null;
  profile: { id: string; nome: string; role: string } | null;
}

export function FechamentoTable({ rows }: { rows: Row[] }) {
  const [editing, setEditing] = useState<Row | null>(null);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Colaborador</th>
              <th className="px-3 py-2 text-left font-medium">Papel</th>
              <th className="px-3 py-2 text-right font-medium">Fixo</th>
              <th className="px-3 py-2 text-right font-medium">Variável</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
              <th className="px-3 py-2 text-left font-medium">Justificativa</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{r.profile?.nome ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {roleLabels[r.papel_naquele_mes] ?? r.papel_naquele_mes}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{brl(Number(r.fixo))}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {brl(Number(r.valor_variavel))}
                  {Number(r.ajuste_manual) !== 0 && (
                    <span className="ml-1 text-[10px] text-amber-600">(ajustado)</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{brl(Number(r.valor_total))}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground max-w-[200px] truncate">
                  {r.justificativa_ajuste ?? "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  {r.status === "pending_approval" && (
                    <Button size="sm" variant="outline" onClick={() => setEditing(r)}>
                      Ajustar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <AdjustmentModal
          snapshotId={editing.id}
          currentValor={Number(editing.valor_variavel)}
          collaboratorName={editing.profile?.nome ?? "Colaborador"}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step C4.4: Criar `/comissoes/fechamento/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { CommissionTabs } from "@/components/comissoes/CommissionTabs";
import { FechamentoTable } from "@/components/comissoes/FechamentoTable";
import { ApproveMonthButton } from "@/components/comissoes/ApproveMonthButton";
import { listSnapshotsForMonth, getMonthsAwaitingApproval } from "@/lib/comissoes/queries";

function formatMonthLong(monthRef: string): string {
  const [year, month] = monthRef.split("-");
  const names = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${names[Number(month) - 1]} de ${year}`;
}

export default async function FechamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const params = await searchParams;
  const user = await requireAuth();
  if (!canAccess(user.role, "approve:monthly_closing")) notFound();

  const pending = await getMonthsAwaitingApproval();

  // Default = primeiro mês com pending; se não há, mês passado
  let monthRef = params.mes && /^\d{4}-\d{2}$/.test(params.mes) ? params.mes : null;
  if (!monthRef) {
    if (pending.length > 0) monthRef = pending[0];
    else {
      const now = new Date();
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      monthRef = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
    }
  }

  const rows = (await listSnapshotsForMonth(monthRef)) as unknown as Parameters<typeof FechamentoTable>[0]["rows"];
  const pendingThisMonth = rows.filter((r) => r.status === "pending_approval");
  const hasNegative = pendingThisMonth.some((r) => Number(r.valor_total) < 0);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Fechamento de comissões</h1>
        <p className="text-sm text-muted-foreground">
          Revise e aprove a folha do mês.
        </p>
      </header>

      <CommissionTabs
        active="fechamento"
        showVisaoGeral={true}
        showFechamento={true}
        pendingMesesCount={pending.length}
      />

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Mês:</span>
        <span className="text-sm">{formatMonthLong(monthRef)}</span>
        <span className="text-xs text-muted-foreground">
          ({pendingThisMonth.length} pendente{pendingThisMonth.length === 1 ? "" : "s"})
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhum snapshot neste mês.
        </p>
      ) : (
        <>
          <FechamentoTable rows={rows} />
          {pendingThisMonth.length > 0 && (
            <div className="border-t pt-5">
              <ApproveMonthButton
                monthRef={monthRef}
                monthLabel={formatMonthLong(monthRef)}
                count={pendingThisMonth.length}
                hasNegative={hasNegative}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step C4.5: Typecheck + commit**

```bash
npm run typecheck
git add src/components/comissoes/AdjustmentModal.tsx \
  src/components/comissoes/ApproveMonthButton.tsx \
  src/components/comissoes/FechamentoTable.tsx \
  "src/app/(authed)/comissoes/fechamento/page.tsx"
git commit -m "feat(comissoes): /comissoes/fechamento page with inline adjustment and approve flow"
```

---

## Bloco D — E2E + push

### Task D1: E2E + push + PR

**Files:**
- Create: `tests/e2e/comissoes.spec.ts`

- [ ] **Step D1.1: Criar test e2e**

```ts
import { test, expect } from "@playwright/test";

test("rota /comissoes redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/comissoes");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /comissoes/minhas redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/comissoes/minhas");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /comissoes/visao-geral redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/comissoes/visao-geral");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /comissoes/fechamento redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/comissoes/fechamento");
  await expect(page).toHaveURL(/\/login/);
});

test("endpoint /api/cron/monthly-snapshot retorna 401 sem header de autorização", async ({ request }) => {
  const res = await request.get("/api/cron/monthly-snapshot");
  expect(res.status()).toBe(401);
});

test("endpoint /api/cron/monthly-snapshot retorna 401 com bearer errado", async ({ request }) => {
  const res = await request.get("/api/cron/monthly-snapshot", {
    headers: { authorization: "Bearer invalido" },
  });
  expect(res.status()).toBe(401);
});
```

- [ ] **Step D1.2: Rodar testes + typecheck**

```bash
npm run test
npm run typecheck
```

- [ ] **Step D1.3: Commit**

```bash
git add tests/e2e/comissoes.spec.ts
git commit -m "test(e2e): comissoes auth-redirect and cron endpoint 401"
```

- [ ] **Step D1.4: Push**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
git push origin claude/frosty-jang-a815ff
```

- [ ] **Step D1.5: Abrir PR**

```bash
/opt/homebrew/bin/gh pr create --base main --head claude/frosty-jang-a815ff \
  --title "feat: Fase 7 — Comissões (snapshots mensais + cron + aprovação)" \
  --body "Implementa Fase 7 conforme spec docs/superpowers/specs/2026-04-27-fase-7-comissoes-design.md"
```

- [ ] **Step D1.6: Verificar Production deploy depois do merge**

```bash
/opt/homebrew/bin/gh api repos/time-yide/yide-acompanha/deployments --jq '.[0].id' \
  | xargs -I {} /opt/homebrew/bin/gh api repos/time-yide/yide-acompanha/deployments/{}/statuses
```

Esperar: `success`. **Primeiro snapshot do mês 1 do próximo mês às 00:00 BRT** — verificar Vercel Logs depois.

---

## Self-Review

### Cobertura do spec — seção 5.7

| Spec | Coberto por |
|---|---|
| Tabelas commission_snapshots + items | A1 |
| 3 fórmulas (assessor, coord, comercial) | B1 |
| Audiovisual Chefe = Coordenador | B1 (mesma fórmula) |
| Cron 1º do mês 00:00 BRT | B3 (vercel.json `0 3 1 * *`) |
| Sócio aprova em /comissoes/fechamento | C4 |
| Ajuste manual com motivo | B4 + C4 (AdjustmentModal) |
| Audit log | B4 |
| Sub-aba Visão geral | C3 |
| Sub-aba Minhas comissões com detalhamento | C2 + C1 (CommissionBreakdown) |
| Sub-aba Fechamento | C4 |
| Previsão tempo real | C1 (preview.ts) + C2 (PreviewCard) |
| Sócio sem comissão | B1 (retorna null) + C2 (redirect) |
| Notificação `mes_aguardando_aprovacao` | B2 (no fim do generator) |
| Notificação `mes_aprovado` | B4 (no fim do approveMonthAction) |
| Aprovação imutável | B4 (rejeita ajuste em snapshot aprovado) |

### Lacunas conhecidas (intencionais)

- Reabrir mês aprovado → não tem (decisão de design)
- Snapshot retroativo manual → futuro
- Comissão pro-rata → fora do MVP
- PDF / contracheque → futuro
- Dashboard de comissões histórico → Fase 9

---

## Resumo da entrega

Após executar:

- 2 tabelas (`commission_snapshots` + `commission_snapshot_items`) com RLS
- Calculator puro com fórmulas por papel (8 cases testados)
- Generator idempotente que cria snapshots e dispara notificação
- Cron mensal `0 3 1 * *` (00:00 BRT dia 1) no slot 2 do Vercel Hobby
- 4 páginas (`/comissoes` redirector + minhas + visao-geral + fechamento)
- 9 componentes novos
- 2 server actions (ajustar + aprovar) com audit log
- Integração com Fase 6 (notificações `mes_aguardando_aprovacao` e `mes_aprovado`)
- Tests: 8 calculator + 3 generator + 4 actions = 15 unit + 6 e2e

Total: **~13 commits** (A1, A2, B1, B2, B3, B4, C1, C2, C3, C4, D1, e mais 2 implícitos durante a integração).
