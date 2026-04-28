# Fase 8 — Satisfação + IA (Yide Digital) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sistema de satisfação semanal de clientes com avaliação manual (cor + comentário) por coord/assessor/produtor, síntese por IA (Claude haiku-4-5 com prompt caching), ranking público (Top 10 mais e Top 10 menos satisfeitos), aba "Satisfação" na pasta do cliente, e integração com Fase 6 (notificações `satisfacao_pendente` e `cliente_perto_churn`).

**Architecture:** Tabelas `satisfaction_entries` (avaliação) + `satisfaction_synthesis` (síntese IA, 1 por cliente/semana). UI batch com auto-save instantâneo. Síntese real-time via server action quando 2ª avaliação chega; fallback quinta-feira via cron daily-digest existente (substitui detector stub `satisfacao-pendente.ts` da Fase 6). Função pura `synthesizeClientSatisfaction` consumida tanto pelo trigger real-time quanto pelo cron. Detector de churn dispara `cliente_perto_churn` quando 2 sínteses vermelhas seguidas.

**Tech Stack:** Next.js 16 + Supabase (Postgres + RLS) + `@anthropic-ai/sdk` (Claude haiku-4-5 com prompt caching) + Base UI + Tailwind + Zod + Vitest + Playwright.

**Spec:** [docs/superpowers/specs/2026-04-27-fase-8-satisfacao-design.md](../specs/2026-04-27-fase-8-satisfacao-design.md)

**Plano anterior:** [Fase 7 — Comissões](2026-04-27-fase-7-comissoes.md)

**Fora do escopo:**
- Pesquisa de satisfação enviada ao cliente final → futuro
- Comparação histórica entre coordenadores → futuro
- Editar avaliação retroativa e regenerar síntese → futuro
- Resumo mensal de satisfação no dashboard → Fase 9
- Multi-cliente: avaliação por departamento dentro do cliente → fora do MVP

**Pré-requisitos:**
- `ANTHROPIC_API_KEY` configurado no Vercel (Production/Preview) — usuária já configurou
- `CRON_SECRET` no Vercel (existe desde Fase 6) — usado pelo detector via daily-digest

**Estado atual no repositório:**
- `src/lib/cron/detectors/satisfacao-pendente.ts` — stub criado na Fase 6 (no-op)
- `src/lib/notificacoes/dispatch.ts` (Fase 6) com `dispatchNotification`
- `src/lib/cron/daily-digest.ts` já chama o detector via `safeDetect()`
- Triggers `satisfacao_pendente` e `cliente_perto_churn` já estão na seed das `notification_rules` (Fase 6)
- ClienteSidebar (`src/components/clientes/ClienteSidebar.tsx`) NÃO tem item "Satisfação" ainda — vamos adicionar

**Estrutura final esperada:**

```
supabase/migrations/
└── 20260427000016_satisfaction.sql                [NEW]

src/
├── app/
│   └── (authed)/
│       ├── satisfacao/
│       │   ├── page.tsx                           [NEW — ranking principal]
│       │   └── avaliar/page.tsx                   [NEW — batch evaluation]
│       └── clientes/[id]/satisfacao/page.tsx      [NEW — aba do cliente]
│
├── components/
│   ├── satisfacao/                                [NEW]
│   │   ├── EvaluationRow.tsx
│   │   ├── ColorButtons.tsx
│   │   ├── CommentBox.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── SatisfactionSparkline.tsx
│   │   ├── RankingCard.tsx
│   │   ├── TopRanking.tsx
│   │   ├── BottomRanking.tsx
│   │   ├── OthersTable.tsx
│   │   ├── WeeklySatisfactionDetail.tsx
│   │   └── WeekSelector.tsx
│   └── clientes/ClienteSidebar.tsx                [MODIFY — add Satisfação item]
│
├── lib/
│   ├── ai/client.ts                               [NEW — Anthropic wrapper]
│   ├── env.ts                                     [MODIFY — ANTHROPIC_API_KEY opcional]
│   ├── satisfacao/                                [NEW]
│   │   ├── schema.ts                              [zod + interfaces]
│   │   ├── iso-week.ts                            [helpers de semana ISO]
│   │   ├── queries.ts
│   │   ├── actions.ts                             [server actions]
│   │   └── synthesizer.ts                         [chamada à IA]
│   └── cron/detectors/satisfacao-pendente.ts      [REPLACE stub]
│
└── types/database.ts                              [REGENERATE]

vercel.json                                        # sem mudança
package.json                                       [MODIFY — +@anthropic-ai/sdk]

tests/
├── unit/
│   ├── satisfacao-iso-week.test.ts                [NEW]
│   ├── satisfacao-synthesizer.test.ts             [NEW]
│   ├── satisfacao-actions.test.ts                 [NEW]
│   └── satisfacao-detector.test.ts                [NEW]
└── e2e/
    └── satisfacao.spec.ts                         [NEW]
```

**Total estimado:** ~16 commits.

---

## Bloco A — Migration + Setup

### Task A1: Migration `satisfaction_entries` + `satisfaction_synthesis`

**Files:**
- Create: `supabase/migrations/20260427000016_satisfaction.sql`

- [ ] **Step A1.1: Escrever SQL**

```sql
-- supabase/migrations/20260427000016_satisfaction.sql

create type public.satisfaction_color as enum ('verde', 'amarelo', 'vermelho');

-- =============================================
-- satisfaction_entries (avaliação manual)
-- =============================================
create table public.satisfaction_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  autor_id uuid not null references public.profiles(id),
  papel_autor text not null,
  semana_iso text not null,
  cor public.satisfaction_color,
  comentario text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index uq_satisfaction_entries_client_autor_semana
  on public.satisfaction_entries(client_id, autor_id, semana_iso);

create index idx_satisfaction_entries_semana_cor
  on public.satisfaction_entries(semana_iso, cor);

create index idx_satisfaction_entries_autor_semana
  on public.satisfaction_entries(autor_id, semana_iso);

create trigger trg_satisfaction_entries_updated_at
  before update on public.satisfaction_entries
  for each row execute function public.set_updated_at();

alter table public.satisfaction_entries enable row level security;

-- SELECT: coord/socio/adm/produtores leem todas; assessor lê próprias + as do mesmo cliente onde é assessor;
-- comerciais não veem
create policy "satisfaction_entries select"
  on public.satisfaction_entries for select to authenticated
  using (
    public.current_user_role() in ('socio', 'adm', 'coordenador', 'audiovisual_chefe', 'videomaker', 'designer', 'editor')
    or autor_id = auth.uid()
    or exists (
      select 1 from public.clients c
      where c.id = client_id
        and (c.assessor_id = auth.uid() or c.coordenador_id = auth.uid())
    )
  );

-- UPDATE: só o autor da entry
create policy "satisfaction_entries update own"
  on public.satisfaction_entries for update to authenticated
  using (autor_id = auth.uid())
  with check (autor_id = auth.uid());

-- INSERT: o próprio user (criando manualmente) — service-role faz bootstrap dos pendentes
create policy "satisfaction_entries insert own"
  on public.satisfaction_entries for insert to authenticated
  with check (autor_id = auth.uid());

-- DELETE: só sócio
create policy "satisfaction_entries delete socio"
  on public.satisfaction_entries for delete to authenticated
  using (public.current_user_role() = 'socio');

-- =============================================
-- satisfaction_synthesis (síntese IA)
-- =============================================
create table public.satisfaction_synthesis (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  semana_iso text not null,
  score_final numeric(3,1) not null,
  cor_final public.satisfaction_color not null,
  resumo_ia text not null,
  divergencia_detectada boolean not null default false,
  acao_sugerida text,
  ai_input_hash text,
  ai_tokens_used integer,
  created_at timestamptz not null default now()
);

create unique index uq_satisfaction_synthesis_client_semana
  on public.satisfaction_synthesis(client_id, semana_iso);

create index idx_satisfaction_synthesis_semana_cor
  on public.satisfaction_synthesis(semana_iso, cor_final);

create index idx_satisfaction_synthesis_score
  on public.satisfaction_synthesis(semana_iso, score_final desc);

alter table public.satisfaction_synthesis enable row level security;

-- SELECT: todos autenticados (transparência da agência)
create policy "satisfaction_synthesis select all"
  on public.satisfaction_synthesis for select to authenticated using (true);

-- INSERT/UPDATE/DELETE: só service-role (sem policy = bloqueia para clients normais)
```

- [ ] **Step A1.2: Aplicar e commit**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
SUPABASE_ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.env.local" | cut -d= -f2) \
  npx supabase db push --include-all
```

Esperar: `Applying migration 20260427000016_satisfaction.sql...` sem erro.

```bash
git add supabase/migrations/20260427000016_satisfaction.sql
git commit -m "feat(db): satisfaction_entries and synthesis tables with RLS"
```

---

### Task A2: Regenerar tipos do banco

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step A2.1: Regenerar e verificar**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
SUPABASE_ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.env.local" | cut -d= -f2) \
  SUPABASE_PROJECT_ID=jelvhwbpipawghwufpbc \
  npm run db:types
npm run typecheck
```

Esperar: `Database["public"]["Enums"]["satisfaction_color"]` agora existe; `satisfaction_entries` e `satisfaction_synthesis` em `Tables`. Typecheck clean.

- [ ] **Step A2.2: Commit**

```bash
git add src/types/database.ts
git commit -m "chore(db): regenerate types after satisfaction tables"
```

---

### Task A3: env.ts `ANTHROPIC_API_KEY` opcional + instalar `@anthropic-ai/sdk`

**Files:**
- Modify: `src/lib/env.ts`
- Modify: `.env.example`
- Modify: `package.json` (via npm install)

- [ ] **Step A3.1: Atualizar `src/lib/env.ts`**

Localize o `serverSchema` no arquivo (já tem `CRON_SECRET` opcional desde Fase 6). Adicionar `ANTHROPIC_API_KEY` opcional:

```ts
const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SUPABASE_PROJECT_ID: z.string().min(1),
  RESEND_API_KEY: z.string().min(10),
  RESEND_FROM: z.string().min(5),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  CRON_SECRET: z.string().optional(),
  // Opcional: usado pelo synthesizer da satisfação. Sem isso, IA não roda mas avaliação manual continua.
  ANTHROPIC_API_KEY: z.string().optional(),
});
```

- [ ] **Step A3.2: Atualizar `.env.example`**

Adicionar abaixo do CRON_SECRET:

```bash
# Opcional: usado pela síntese de satisfação. Get em https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=
```

- [ ] **Step A3.3: Instalar `@anthropic-ai/sdk`**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
npm install @anthropic-ai/sdk
npm run typecheck
```

Esperar: instala sem erro, typecheck clean.

- [ ] **Step A3.4: Commit**

```bash
git add src/lib/env.ts .env.example package.json package-lock.json
git commit -m "chore: add ANTHROPIC_API_KEY env var (optional) and install @anthropic-ai/sdk"
```

---

## Bloco B — Backend Core

### Task B1: `iso-week.ts` — helpers de semana ISO 8601 (TDD)

**Files:**
- Create: `src/lib/satisfacao/iso-week.ts`
- Create: `tests/unit/satisfacao-iso-week.test.ts`

- [ ] **Step B1.1: Escrever testes (TDD)**

Crie `tests/unit/satisfacao-iso-week.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isoWeek, currentIsoWeek, previousIsoWeek } from "@/lib/satisfacao/iso-week";

describe("isoWeek", () => {
  it("retorna formato 'YYYY-Www'", () => {
    const w = isoWeek(new Date(Date.UTC(2026, 3, 15))); // 15-abr-2026 (quarta)
    expect(w).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("calcula semana 17 corretamente para 14-abr-2026 (segunda)", () => {
    const w = isoWeek(new Date(Date.UTC(2026, 3, 14)));
    expect(w).toBe("2026-W16");
  });

  it("primeiro dia útil do ano (segunda 5-jan-2026) = 2026-W02", () => {
    const w = isoWeek(new Date(Date.UTC(2026, 0, 5)));
    expect(w).toBe("2026-W02");
  });

  it("virada de ano (segunda 30-dez-2024) = 2025-W01 (ISO 8601 sets W01 contains first Thursday)", () => {
    const w = isoWeek(new Date(Date.UTC(2024, 11, 30)));
    expect(w).toBe("2025-W01");
  });

  it("dezembro tardio em ano de 53 semanas (28-dez-2026 segunda) = 2026-W53", () => {
    const w = isoWeek(new Date(Date.UTC(2026, 11, 28)));
    expect(w).toBe("2026-W53");
  });
});

describe("previousIsoWeek", () => {
  it("retorna semana anterior dentro do ano", () => {
    expect(previousIsoWeek("2026-W17")).toBe("2026-W16");
  });

  it("virada de ano: previousIsoWeek de 2026-W01 retorna 2025-W53 ou W52 (dependendo do ano)", () => {
    const prev = previousIsoWeek("2026-W01");
    expect(prev === "2025-W52" || prev === "2025-W53").toBe(true);
  });
});

describe("currentIsoWeek", () => {
  it("retorna formato válido", () => {
    expect(currentIsoWeek()).toMatch(/^\d{4}-W\d{2}$/);
  });
});
```

- [ ] **Step B1.2: Rodar testes, esperar falhar**

```bash
npm run test -- tests/unit/satisfacao-iso-week.test.ts
```

Esperar: erro de import (módulo não existe).

- [ ] **Step B1.3: Criar `src/lib/satisfacao/iso-week.ts`**

```ts
/**
 * Helpers de semana ISO 8601.
 * Formato: 'YYYY-Www' (ex: '2026-W17').
 * ISO 8601 define semana 01 como aquela que contém a primeira quinta-feira do ano.
 */

export function isoWeek(date: Date = new Date()): string {
  // Cópia em UTC pra evitar pulos de fuso horário
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Domingo=0, Segunda=1, ..., Sábado=6 (UTC). ISO usa segunda como início da semana.
  const dayNum = (target.getUTCDay() + 6) % 7; // segunda=0 ... domingo=6
  // Ir pra quinta-feira da semana atual
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const yearOfThursday = target.getUTCFullYear();
  // Primeira quinta-feira do ano
  const firstThursday = new Date(Date.UTC(yearOfThursday, 0, 4));
  const firstThursdayDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDayNum + 3);
  // Diferença em semanas
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${yearOfThursday}-W${String(week).padStart(2, "0")}`;
}

export function currentIsoWeek(): string {
  return isoWeek(new Date());
}

export function previousIsoWeek(weekIso: string): string {
  // Pega data de uma quinta-feira da semana referenciada e subtrai 7 dias
  const match = weekIso.match(/^(\d{4})-W(\d{2})$/);
  if (!match) throw new Error(`Invalid ISO week format: ${weekIso}`);
  const [, yearStr, weekStr] = match;
  const year = Number(yearStr);
  const week = Number(weekStr);
  // Quinta da primeira semana ISO do ano = 4-jan ajustado
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4DayNum = (jan4.getUTCDay() + 6) % 7;
  // Quinta da semana 1
  const thursdayWeek1 = new Date(jan4);
  thursdayWeek1.setUTCDate(jan4.getUTCDate() - jan4DayNum + 3);
  // Quinta da semana especificada
  const thursdayWeekN = new Date(thursdayWeek1);
  thursdayWeekN.setUTCDate(thursdayWeek1.getUTCDate() + (week - 1) * 7);
  // Subtrai 7 dias e calcula isoWeek dessa data
  thursdayWeekN.setUTCDate(thursdayWeekN.getUTCDate() - 7);
  return isoWeek(thursdayWeekN);
}
```

- [ ] **Step B1.4: Rodar testes, esperar passar**

```bash
npm run test -- tests/unit/satisfacao-iso-week.test.ts
```

Esperar: todos os 7 testes passam.

- [ ] **Step B1.5: Commit**

```bash
git add src/lib/satisfacao/iso-week.ts tests/unit/satisfacao-iso-week.test.ts
git commit -m "feat(satisfacao): iso-week helpers with TDD"
```

---

### Task B2: `ai/client.ts` — wrapper Anthropic

**Files:**
- Create: `src/lib/ai/client.ts`

- [ ] **Step B2.1: Criar `src/lib/ai/client.ts`**

```ts
// SERVER ONLY: do not import from client components
import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

/**
 * Retorna cliente Anthropic singleton, ou null se ANTHROPIC_API_KEY não estiver configurado.
 * Callers devem checar null e fallback gracioso.
 */
export function getAnthropicClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  if (!_client) {
    _client = new Anthropic({ apiKey: key });
  }
  return _client;
}

export const SATISFACTION_MODEL = "claude-haiku-4-5";

export const MAX_TOKENS = 1024;
```

- [ ] **Step B2.2: Typecheck e commit**

```bash
npm run typecheck
git add src/lib/ai/client.ts
git commit -m "feat(ai): Anthropic client wrapper with optional key"
```

---

### Task B3: `satisfacao/schema.ts` — zod + interfaces

**Files:**
- Create: `src/lib/satisfacao/schema.ts`

- [ ] **Step B3.1: Criar `src/lib/satisfacao/schema.ts`**

```ts
import { z } from "zod";

export const SATISFACTION_COLORS = ["verde", "amarelo", "vermelho"] as const;
export type SatisfactionColor = typeof SATISFACTION_COLORS[number];

// =============================================
// Server actions (zod schemas)
// =============================================

export const setColorSchema = z.object({
  client_id: z.string().uuid(),
  cor: z.enum(SATISFACTION_COLORS),
});

export const setCommentSchema = z.object({
  client_id: z.string().uuid(),
  comentario: z.string().max(2000, "Comentário muito longo").optional().nullable(),
});

export type SetColorInput = z.infer<typeof setColorSchema>;
export type SetCommentInput = z.infer<typeof setCommentSchema>;

// =============================================
// Synthesizer (input/output)
// =============================================

export interface SynthesisInput {
  client: {
    id: string;
    nome: string;
    valor_mensal: number;
    data_entrada: string;          // ISO date 'YYYY-MM-DD'
    servico_contratado: string | null;
  };
  current_week_iso: string;
  current_entries: Array<{
    papel: string;
    cor: SatisfactionColor;
    comentario: string | null;
  }>;
  history_4_weeks: Array<{
    semana_iso: string;
    cor_final: SatisfactionColor;
    resumo_ia: string;
  }>;
}

export interface SynthesisOutput {
  score_final: number;             // 0.0 - 10.0
  cor_final: SatisfactionColor;
  resumo_ia: string;
  divergencia_detectada: boolean;
  acao_sugerida: string | null;
  ai_tokens_used: number;
}

// Zod schema pro retorno parseado da IA (validação)
export const synthesisOutputSchema = z.object({
  score_final: z.coerce.number().min(0).max(10),
  cor_final: z.enum(SATISFACTION_COLORS),
  resumo_ia: z.string().min(1),
  divergencia_detectada: z.boolean(),
  acao_sugerida: z.string().nullable().optional(),
});
```

- [ ] **Step B3.2: Typecheck e commit**

```bash
npm run typecheck
git add src/lib/satisfacao/schema.ts
git commit -m "feat(satisfacao): schemas (zod + interfaces) for actions and synthesizer"
```

---

### Task B4: `synthesizer.ts` — chamada à IA com prompt caching (TDD)

**Files:**
- Create: `src/lib/satisfacao/synthesizer.ts`
- Create: `tests/unit/satisfacao-synthesizer.test.ts`

- [ ] **Step B4.1: Escrever testes (TDD)**

Crie `tests/unit/satisfacao-synthesizer.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const messagesCreateMock = vi.hoisted(() => vi.fn());
const getClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/client", () => ({
  getAnthropicClient: getClientMock,
  SATISFACTION_MODEL: "claude-haiku-4-5",
  MAX_TOKENS: 1024,
}));

import { synthesizeClientSatisfaction } from "@/lib/satisfacao/synthesizer";

beforeEach(() => {
  messagesCreateMock.mockReset();
  getClientMock.mockReset();
});

const baseInput = {
  client: {
    id: "c1",
    nome: "Pizzaria Bella",
    valor_mensal: 4500,
    data_entrada: "2025-08-01",
    servico_contratado: "Social media + tráfego",
  },
  current_week_iso: "2026-W17",
  current_entries: [
    { papel: "coordenador", cor: "verde" as const, comentario: "Cliente satisfeito" },
    { papel: "assessor", cor: "verde" as const, comentario: null },
  ],
  history_4_weeks: [],
};

describe("synthesizeClientSatisfaction", () => {
  it("retorna null se ANTHROPIC_API_KEY não estiver configurado", async () => {
    getClientMock.mockReturnValue(null);
    const r = await synthesizeClientSatisfaction(baseInput);
    expect(r).toBeNull();
    expect(messagesCreateMock).not.toHaveBeenCalled();
  });

  it("parseia JSON válido da IA e retorna SynthesisOutput", async () => {
    getClientMock.mockReturnValue({
      messages: { create: messagesCreateMock },
    });
    messagesCreateMock.mockResolvedValue({
      content: [{
        type: "text",
        text: JSON.stringify({
          score_final: 9.2,
          cor_final: "verde",
          resumo_ia: "Cliente em alta satisfação...",
          divergencia_detectada: false,
          acao_sugerida: null,
        }),
      }],
      usage: { input_tokens: 500, output_tokens: 80 },
    });
    const r = await synthesizeClientSatisfaction(baseInput);
    expect(r).not.toBeNull();
    expect(r!.score_final).toBe(9.2);
    expect(r!.cor_final).toBe("verde");
    expect(r!.divergencia_detectada).toBe(false);
    expect(r!.ai_tokens_used).toBe(580);
  });

  it("retorna null se a IA retornar JSON malformado", async () => {
    getClientMock.mockReturnValue({
      messages: { create: messagesCreateMock },
    });
    messagesCreateMock.mockResolvedValue({
      content: [{ type: "text", text: "not json at all" }],
      usage: { input_tokens: 100, output_tokens: 10 },
    });
    const r = await synthesizeClientSatisfaction(baseInput);
    expect(r).toBeNull();
  });

  it("retorna null se a IA lançar erro de rede", async () => {
    getClientMock.mockReturnValue({
      messages: { create: messagesCreateMock },
    });
    messagesCreateMock.mockRejectedValue(new Error("network down"));
    const r = await synthesizeClientSatisfaction(baseInput);
    expect(r).toBeNull();
  });

  it("envia system prompt cached (cache_control ephemeral)", async () => {
    getClientMock.mockReturnValue({
      messages: { create: messagesCreateMock },
    });
    messagesCreateMock.mockResolvedValue({
      content: [{
        type: "text",
        text: JSON.stringify({
          score_final: 8,
          cor_final: "verde",
          resumo_ia: "ok",
          divergencia_detectada: false,
          acao_sugerida: null,
        }),
      }],
      usage: { input_tokens: 500, output_tokens: 50 },
    });
    await synthesizeClientSatisfaction(baseInput);
    const args = messagesCreateMock.mock.calls[0][0];
    // System prompt deve ter cache_control: ephemeral no último bloco
    expect(args.system).toBeDefined();
    if (Array.isArray(args.system)) {
      const last = args.system[args.system.length - 1];
      expect(last.cache_control).toEqual({ type: "ephemeral" });
    }
  });
});
```

- [ ] **Step B4.2: Rodar testes, esperar falhar**

```bash
npm run test -- tests/unit/satisfacao-synthesizer.test.ts
```

- [ ] **Step B4.3: Criar `src/lib/satisfacao/synthesizer.ts`**

```ts
// SERVER ONLY: do not import from client components
import { getAnthropicClient, SATISFACTION_MODEL, MAX_TOKENS } from "@/lib/ai/client";
import { synthesisOutputSchema, type SynthesisInput, type SynthesisOutput } from "./schema";

function buildSystemPrompt(input: SynthesisInput): string {
  const monthsCount = monthsBetween(input.client.data_entrada, new Date());
  const historyText = input.history_4_weeks.length === 0
    ? "(sem histórico anterior)"
    : input.history_4_weeks
        .map((h) => `- ${h.semana_iso}: ${h.cor_final} — ${h.resumo_ia}`)
        .join("\n");
  return `Você é um analista de satisfação de clientes da Yide Digital.

Cliente: ${input.client.nome}
Valor mensal: R$ ${input.client.valor_mensal}
Tempo de casa: ${monthsCount} meses (entrou em ${input.client.data_entrada})
Serviço contratado: ${input.client.servico_contratado ?? "não informado"}

Histórico das últimas 4 semanas (mais recente primeiro):
${historyText}`;
}

function buildUserPrompt(input: SynthesisInput): string {
  const entriesText = input.current_entries
    .map((e) => `${e.papel}: ${e.cor}${e.comentario ? " - " + e.comentario : ""}`)
    .join("\n");
  return `Avaliações desta semana (${input.current_week_iso}):
${entriesText}

Sintetize a satisfação desta semana em JSON:
{
  "score_final": número 0-10,
  "cor_final": "verde" | "amarelo" | "vermelho",
  "resumo_ia": "1-2 parágrafos analisando a semana e tendência",
  "divergencia_detectada": true se coord e assessor deram cores diferentes,
  "acao_sugerida": null se cor_final=verde; texto curto sugerindo ação se amarelo/vermelho
}

Regras:
- Score 0-3 = vermelho, 4-7 = amarelo, 8-10 = verde
- Se só tem 1 avaliação (a outra falhou), divergencia_detectada=false, score baseado nela
- Resumo deve referenciar contexto histórico se houver tendência (ex: "3ª semana seguida em vermelho — ação urgente")
- Tom profissional, direto, em português

Retorne APENAS o JSON, sem texto antes ou depois.`;
}

function monthsBetween(isoStart: string, end: Date): number {
  const start = new Date(isoStart);
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return Math.max(0, months);
}

function extractText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  for (const block of content) {
    if (block && typeof block === "object" && "type" in block && (block as { type: string }).type === "text") {
      const text = (block as { text?: string }).text;
      if (typeof text === "string") return text;
    }
  }
  return "";
}

export async function synthesizeClientSatisfaction(
  input: SynthesisInput,
): Promise<SynthesisOutput | null> {
  const client = getAnthropicClient();
  if (!client) {
    console.warn("[synthesizer] ANTHROPIC_API_KEY not configured; skipping synthesis");
    return null;
  }

  const systemPrompt = buildSystemPrompt(input);
  const userPrompt = buildUserPrompt(input);

  try {
    const response = await client.messages.create({
      model: SATISFACTION_MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    const rawText = extractText(response.content);
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error("[synthesizer] failed to parse AI JSON response:", rawText.slice(0, 200));
      return null;
    }

    const validated = synthesisOutputSchema.safeParse(parsed);
    if (!validated.success) {
      console.error("[synthesizer] AI response failed schema validation:", validated.error.issues);
      return null;
    }

    const tokens = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

    return {
      score_final: validated.data.score_final,
      cor_final: validated.data.cor_final,
      resumo_ia: validated.data.resumo_ia,
      divergencia_detectada: validated.data.divergencia_detectada,
      acao_sugerida: validated.data.acao_sugerida ?? null,
      ai_tokens_used: tokens,
    };
  } catch (err) {
    console.error("[synthesizer] AI call failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
```

- [ ] **Step B4.4: Rodar testes, esperar passar**

```bash
npm run test -- tests/unit/satisfacao-synthesizer.test.ts
npm run typecheck
```

Esperar: 5/5 passa, typecheck clean.

- [ ] **Step B4.5: Commit**

```bash
git add src/lib/satisfacao/synthesizer.ts tests/unit/satisfacao-synthesizer.test.ts
git commit -m "feat(satisfacao): synthesizer with prompt caching and graceful AI failure"
```

---

### Task B5: `queries.ts` — funções de leitura

**Files:**
- Create: `src/lib/satisfacao/queries.ts`

- [ ] **Step B5.1: Criar `src/lib/satisfacao/queries.ts`**

```ts
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { SatisfactionColor } from "./schema";
import type { Database } from "@/types/database";

type RoleEnum = Database["public"]["Enums"]["user_role"];

interface ClienteRow {
  id: string;
  nome: string;
  assessor_id: string | null;
  coordenador_id: string | null;
}

/**
 * Lista clientes que o user pode/deve avaliar nesta semana.
 * - Coord/Sócio/ADM/Audiovisual Chefe/Produtores: todos clientes ativos.
 * - Assessor: só os clientes onde é assessor.
 * - Outros: vazio.
 */
export async function listClientsForUser(userId: string, role: RoleEnum): Promise<ClienteRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("clients")
    .select("id, nome, assessor_id, coordenador_id")
    .eq("status", "ativo")
    .order("nome");

  if (role === "assessor") {
    query = query.eq("assessor_id", userId);
  } else if (!["socio", "adm", "coordenador", "audiovisual_chefe", "videomaker", "designer", "editor"].includes(role)) {
    return [];
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ClienteRow[];
}

export interface EntryRow {
  id: string;
  client_id: string;
  autor_id: string;
  papel_autor: string;
  semana_iso: string;
  cor: SatisfactionColor | null;
  comentario: string | null;
}

export async function listEntriesForUserWeek(userId: string, weekIso: string): Promise<EntryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("satisfaction_entries")
    .select("id, client_id, autor_id, papel_autor, semana_iso, cor, comentario")
    .eq("autor_id", userId)
    .eq("semana_iso", weekIso);
  if (error) throw error;
  return (data ?? []) as EntryRow[];
}

export async function listEntriesForClientWeek(clientId: string, weekIso: string): Promise<EntryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("satisfaction_entries")
    .select("id, client_id, autor_id, papel_autor, semana_iso, cor, comentario, autor:profiles!satisfaction_entries_autor_id_fkey(nome)")
    .eq("client_id", clientId)
    .eq("semana_iso", weekIso);
  if (error) throw error;
  return (data ?? []) as unknown as EntryRow[];
}

export interface SynthesisRow {
  id: string;
  client_id: string;
  semana_iso: string;
  score_final: number;
  cor_final: SatisfactionColor;
  resumo_ia: string;
  divergencia_detectada: boolean;
  acao_sugerida: string | null;
  created_at: string;
}

export async function getSynthesis(clientId: string, weekIso: string): Promise<SynthesisRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("satisfaction_synthesis")
    .select("*")
    .eq("client_id", clientId)
    .eq("semana_iso", weekIso)
    .maybeSingle();
  return (data as SynthesisRow | null) ?? null;
}

export async function getSynthesisHistory(clientId: string, limit = 12): Promise<SynthesisRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("satisfaction_synthesis")
    .select("*")
    .eq("client_id", clientId)
    .order("semana_iso", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as SynthesisRow[];
}

export async function getSynthesisForWeek(weekIso: string): Promise<Array<SynthesisRow & { cliente: { nome: string; assessor_id: string | null; coordenador_id: string | null } | null }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("satisfaction_synthesis")
    .select("*, cliente:clients(nome, assessor_id, coordenador_id)")
    .eq("semana_iso", weekIso);
  if (error) throw error;
  return (data ?? []) as unknown as Array<SynthesisRow & { cliente: { nome: string; assessor_id: string | null; coordenador_id: string | null } | null }>;
}

/**
 * Conta entries com cor preenchida pra um cliente em uma semana.
 * Usada pelo trigger real-time pra saber quando disparar a síntese.
 * Usa service-role pra ter visão completa (todas avaliações independente do user).
 */
export async function countFilledEntries(clientId: string, weekIso: string): Promise<number> {
  const supabase = createServiceRoleClient();
  const { count } = await supabase
    .from("satisfaction_entries")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("semana_iso", weekIso)
    .not("cor", "is", null);
  return count ?? 0;
}

/**
 * Lista clientes com entries preenchidas mas sem síntese ainda nesta semana.
 * Usado pelo cron quinta-feira pra rodar IA em quem ficou pendente.
 */
export async function listClientsWithEntriesButNoSynthesis(weekIso: string): Promise<string[]> {
  const supabase = createServiceRoleClient();
  const { data: filledEntries } = await supabase
    .from("satisfaction_entries")
    .select("client_id")
    .eq("semana_iso", weekIso)
    .not("cor", "is", null);
  const clientIdsWithEntries = new Set<string>(
    ((filledEntries ?? []) as Array<{ client_id: string }>).map((e) => e.client_id),
  );
  if (clientIdsWithEntries.size === 0) return [];

  const { data: synth } = await supabase
    .from("satisfaction_synthesis")
    .select("client_id")
    .eq("semana_iso", weekIso);
  const clientsWithSynth = new Set<string>(
    ((synth ?? []) as Array<{ client_id: string }>).map((s) => s.client_id),
  );

  return [...clientIdsWithEntries].filter((id) => !clientsWithSynth.has(id));
}
```

- [ ] **Step B5.2: Typecheck e commit**

```bash
npm run typecheck
git add src/lib/satisfacao/queries.ts
git commit -m "feat(satisfacao): queries (clients, entries, synthesis, helpers)"
```

---

### Task B6: `actions.ts` — server actions com trigger real-time (TDD)

**Files:**
- Create: `src/lib/satisfacao/actions.ts`
- Create: `tests/unit/satisfacao-actions.test.ts`

- [ ] **Step B6.1: Escrever testes (TDD)**

Crie `tests/unit/satisfacao-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const fromCookieMock = vi.hoisted(() => vi.fn());
const fromServiceMock = vi.hoisted(() => vi.fn());
const requireAuthMock = vi.hoisted(() => vi.fn());
const synthesizeMock = vi.hoisted(() => vi.fn());
const dispatchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromCookieMock }),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: fromServiceMock }),
}));

vi.mock("@/lib/auth/session", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/lib/satisfacao/synthesizer", () => ({
  synthesizeClientSatisfaction: synthesizeMock,
}));

vi.mock("@/lib/notificacoes/dispatch", () => ({
  dispatchNotification: dispatchMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { setSatisfactionColorAction } from "@/lib/satisfacao/actions";

beforeEach(() => {
  fromCookieMock.mockReset();
  fromServiceMock.mockReset();
  requireAuthMock.mockReset();
  synthesizeMock.mockReset();
  dispatchMock.mockReset();
  requireAuthMock.mockResolvedValue({ id: "u1", role: "coordenador", nome: "Maria" });
});

describe("setSatisfactionColorAction", () => {
  it("rejeita cor inválida", async () => {
    const fd = new FormData();
    fd.set("client_id", "00000000-0000-0000-0000-000000000000");
    fd.set("cor", "azul");
    const r = await setSatisfactionColorAction(fd);
    expect(r).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it("upsert da entry e retorna triggeredSynthesis=false quando 1ª avaliação", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    fromCookieMock.mockImplementation((table) => {
      if (table === "satisfaction_entries") return { upsert: upsertMock };
      return {};
    });
    fromServiceMock.mockImplementation((table) => {
      if (table === "satisfaction_entries") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                not: vi.fn().mockResolvedValue({ count: 1 }), // só 1 entry preenchida = 1ª avaliação
              }),
            }),
          }),
        };
      }
      return {};
    });
    const fd = new FormData();
    fd.set("client_id", "00000000-0000-0000-0000-000000000000");
    fd.set("cor", "verde");
    const r = await setSatisfactionColorAction(fd);
    expect(r).toEqual(expect.objectContaining({ success: true, triggeredSynthesis: false }));
    expect(synthesizeMock).not.toHaveBeenCalled();
  });

  it("dispara síntese quando 2ª avaliação preenchida (countFilled >= 2)", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const upsertSynthMock = vi.fn().mockResolvedValue({ error: null });

    fromCookieMock.mockImplementation((table) => {
      if (table === "satisfaction_entries") return { upsert: upsertMock };
      return {};
    });

    fromServiceMock.mockImplementation((table) => {
      if (table === "satisfaction_entries") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                not: vi.fn().mockResolvedValue({ count: 2 }),
              }),
            }),
          }),
        };
      }
      if (table === "clients") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { id: "c1", nome: "Cliente", valor_mensal: 4000, data_entrada: "2025-01-01", servico_contratado: "X" },
              }),
            }),
          }),
        };
      }
      if (table === "satisfaction_synthesis") {
        return {
          upsert: upsertSynthMock,
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

    synthesizeMock.mockResolvedValue({
      score_final: 9.0,
      cor_final: "verde",
      resumo_ia: "ok",
      divergencia_detectada: false,
      acao_sugerida: null,
      ai_tokens_used: 100,
    });

    const fd = new FormData();
    fd.set("client_id", "00000000-0000-0000-0000-000000000000");
    fd.set("cor", "verde");
    const r = await setSatisfactionColorAction(fd);
    expect(r).toEqual(expect.objectContaining({ success: true, triggeredSynthesis: true }));
    expect(synthesizeMock).toHaveBeenCalledTimes(1);
    expect(upsertSynthMock).toHaveBeenCalled();
  });

  it("não duplica síntese se já existe (idempotência)", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    fromCookieMock.mockImplementation((table) => {
      if (table === "satisfaction_entries") return { upsert: upsertMock };
      return {};
    });

    fromServiceMock.mockImplementation((table) => {
      if (table === "satisfaction_entries") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                not: vi.fn().mockResolvedValue({ count: 2 }),
              }),
            }),
          }),
        };
      }
      if (table === "satisfaction_synthesis") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: "s1", cor_final: "verde" } }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const fd = new FormData();
    fd.set("client_id", "00000000-0000-0000-0000-000000000000");
    fd.set("cor", "verde");
    const r = await setSatisfactionColorAction(fd);
    expect(r).toEqual(expect.objectContaining({ success: true }));
    // Síntese já existe, então não chama de novo
    expect(synthesizeMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step B6.2: Rodar testes, esperar falhar**

```bash
npm run test -- tests/unit/satisfacao-actions.test.ts
```

- [ ] **Step B6.3: Criar `src/lib/satisfacao/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { synthesizeClientSatisfaction } from "./synthesizer";
import { setColorSchema, setCommentSchema, type SynthesisInput, type SatisfactionColor } from "./schema";
import { currentIsoWeek, previousIsoWeek } from "./iso-week";

interface ActionOk { success: true; triggeredSynthesis?: boolean }
interface ActionErr { error: string }
type ActionResult = ActionOk | ActionErr;

export async function setSatisfactionColorAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  const parsed = setColorSchema.safeParse({
    client_id: formData.get("client_id"),
    cor: formData.get("cor"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const weekIso = currentIsoWeek();
  const supabase = await createClient();

  const { error } = await supabase
    .from("satisfaction_entries")
    .upsert({
      client_id: parsed.data.client_id,
      autor_id: actor.id,
      papel_autor: actor.role,
      semana_iso: weekIso,
      cor: parsed.data.cor,
    }, { onConflict: "client_id,autor_id,semana_iso" });
  if (error) return { error: error.message };

  // Trigger real-time: conta entries preenchidas; se >= 2 e ainda não tem síntese, sintetizar
  const filledCount = await countFilledForClient(parsed.data.client_id, weekIso);
  let triggeredSynthesis = false;

  if (filledCount >= 2) {
    const existing = await getExistingSynthesis(parsed.data.client_id, weekIso);
    if (!existing) {
      await synthesizeAndStore(parsed.data.client_id, weekIso, actor.id);
      triggeredSynthesis = true;
    }
  }

  revalidatePath("/satisfacao/avaliar");
  revalidatePath("/satisfacao");
  revalidatePath(`/clientes/${parsed.data.client_id}/satisfacao`);
  return { success: true, triggeredSynthesis };
}

export async function setSatisfactionCommentAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  const parsed = setCommentSchema.safeParse({
    client_id: formData.get("client_id"),
    comentario: formData.get("comentario"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const weekIso = currentIsoWeek();
  const supabase = await createClient();
  const { error } = await supabase
    .from("satisfaction_entries")
    .upsert({
      client_id: parsed.data.client_id,
      autor_id: actor.id,
      papel_autor: actor.role,
      semana_iso: weekIso,
      comentario: parsed.data.comentario ?? null,
    }, { onConflict: "client_id,autor_id,semana_iso" });
  if (error) return { error: error.message };

  return { success: true };
}

// =============================================
// Helpers internos (exportados para o detector também usar)
// =============================================

async function countFilledForClient(clientId: string, weekIso: string): Promise<number> {
  const supabase = createServiceRoleClient();
  const { count } = await supabase
    .from("satisfaction_entries")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("semana_iso", weekIso)
    .not("cor", "is", null);
  return count ?? 0;
}

async function getExistingSynthesis(clientId: string, weekIso: string): Promise<{ id: string; cor_final: SatisfactionColor } | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("satisfaction_synthesis")
    .select("id, cor_final")
    .eq("client_id", clientId)
    .eq("semana_iso", weekIso)
    .maybeSingle();
  return (data as { id: string; cor_final: SatisfactionColor } | null) ?? null;
}

/**
 * Roda IA, persiste síntese, e dispara churn alert se aplicável.
 * Exportada pra o detector (cron quinta-feira) também usar.
 */
export async function synthesizeAndStore(
  clientId: string,
  weekIso: string,
  sourceUserId?: string,
): Promise<void> {
  const supabase = createServiceRoleClient();

  // Carrega cliente
  const { data: client } = await supabase
    .from("clients")
    .select("id, nome, valor_mensal, data_entrada, servico_contratado")
    .eq("id", clientId)
    .single();
  if (!client) return;

  // Entries da semana
  const { data: entriesRows } = await supabase
    .from("satisfaction_entries")
    .select("papel_autor, cor, comentario")
    .eq("client_id", clientId)
    .eq("semana_iso", weekIso)
    .not("cor", "is", null);
  const currentEntries = ((entriesRows ?? []) as Array<{ papel_autor: string; cor: SatisfactionColor; comentario: string | null }>)
    .map((e) => ({ papel: e.papel_autor, cor: e.cor, comentario: e.comentario }));
  if (currentEntries.length === 0) return;

  // Histórico 4 semanas
  const { data: historyRows } = await supabase
    .from("satisfaction_synthesis")
    .select("semana_iso, cor_final, resumo_ia")
    .eq("client_id", clientId)
    .order("semana_iso", { ascending: false })
    .limit(4);

  const input: SynthesisInput = {
    client: {
      id: (client as { id: string }).id,
      nome: (client as { nome: string }).nome,
      valor_mensal: Number((client as { valor_mensal: number }).valor_mensal),
      data_entrada: (client as { data_entrada: string }).data_entrada,
      servico_contratado: (client as { servico_contratado: string | null }).servico_contratado,
    },
    current_week_iso: weekIso,
    current_entries: currentEntries,
    history_4_weeks: ((historyRows ?? []) as Array<{ semana_iso: string; cor_final: SatisfactionColor; resumo_ia: string }>).map((h) => ({
      semana_iso: h.semana_iso,
      cor_final: h.cor_final,
      resumo_ia: h.resumo_ia,
    })),
  };

  const synthesis = await synthesizeClientSatisfaction(input);
  if (!synthesis) return;

  // Persistir
  const { error } = await supabase
    .from("satisfaction_synthesis")
    .upsert({
      client_id: clientId,
      semana_iso: weekIso,
      score_final: synthesis.score_final,
      cor_final: synthesis.cor_final,
      resumo_ia: synthesis.resumo_ia,
      divergencia_detectada: synthesis.divergencia_detectada,
      acao_sugerida: synthesis.acao_sugerida,
      ai_tokens_used: synthesis.ai_tokens_used,
    }, { onConflict: "client_id,semana_iso" });
  if (error) {
    console.error("[satisfacao] failed to persist synthesis:", error.message);
    return;
  }

  // Detector de churn: 2 vermelhos seguidos
  if (synthesis.cor_final === "vermelho") {
    const previous = previousIsoWeek(weekIso);
    const prev = await getExistingSynthesis(clientId, previous);
    if (prev?.cor_final === "vermelho") {
      const clienteData = client as { nome: string };
      await dispatchNotification({
        evento_tipo: "cliente_perto_churn",
        titulo: `Atenção: ${clienteData.nome} em zona vermelha por 2 semanas`,
        mensagem: synthesis.acao_sugerida ?? "Risco de churn — ação urgente recomendada",
        link: `/clientes/${clientId}/satisfacao`,
        source_user_id: sourceUserId,
      });
    }
  }
}
```

- [ ] **Step B6.4: Rodar testes, esperar passar**

```bash
npm run test -- tests/unit/satisfacao-actions.test.ts
npm run typecheck
```

Esperar: 4/4 passa, typecheck clean.

- [ ] **Step B6.5: Commit**

```bash
git add src/lib/satisfacao/actions.ts tests/unit/satisfacao-actions.test.ts
git commit -m "feat(satisfacao): server actions with real-time synthesis trigger and churn detector"
```

---

## Bloco C — UI

### Task C1: Componentes da avaliação batch

**Files:**
- Create: `src/components/satisfacao/ColorButtons.tsx`
- Create: `src/components/satisfacao/CommentBox.tsx`
- Create: `src/components/satisfacao/EvaluationRow.tsx`
- Create: `src/components/satisfacao/ProgressBar.tsx`

- [ ] **Step C1.1: Criar `<ColorButtons>` (client)**

`src/components/satisfacao/ColorButtons.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { setSatisfactionColorAction } from "@/lib/satisfacao/actions";
import type { SatisfactionColor } from "@/lib/satisfacao/schema";

interface Props {
  clientId: string;
  initialCor: SatisfactionColor | null;
}

const colorClasses: Record<SatisfactionColor, { active: string; inactive: string; emoji: string; label: string }> = {
  verde: {
    active: "bg-green-500/30 ring-2 ring-green-500 text-green-700 dark:text-green-300",
    inactive: "bg-green-500/10 hover:bg-green-500/20 text-green-700 dark:text-green-400",
    emoji: "🟢",
    label: "Verde",
  },
  amarelo: {
    active: "bg-amber-500/30 ring-2 ring-amber-500 text-amber-700 dark:text-amber-300",
    inactive: "bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400",
    emoji: "🟡",
    label: "Amarelo",
  },
  vermelho: {
    active: "bg-red-500/30 ring-2 ring-red-500 text-red-700 dark:text-red-300",
    inactive: "bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:text-red-400",
    emoji: "🔴",
    label: "Vermelho",
  },
};

export function ColorButtons({ clientId, initialCor }: Props) {
  const [cor, setCor] = useState<SatisfactionColor | null>(initialCor);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pick(c: SatisfactionColor) {
    setError(null);
    const previous = cor;
    setCor(c); // optimistic
    const fd = new FormData();
    fd.set("client_id", clientId);
    fd.set("cor", c);
    startTransition(async () => {
      const result = await setSatisfactionColorAction(fd);
      if ("error" in result) {
        setError(result.error);
        setCor(previous); // rollback
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {(["verde", "amarelo", "vermelho"] as const).map((c) => {
        const cls = colorClasses[c];
        const isActive = cor === c;
        return (
          <button
            key={c}
            type="button"
            disabled={pending}
            onClick={() => pick(c)}
            aria-label={cls.label}
            className={`flex h-9 w-9 items-center justify-center rounded-lg text-base transition-colors disabled:opacity-50 ${
              isActive ? cls.active : cls.inactive
            }`}
          >
            {cls.emoji}
          </button>
        );
      })}
      {error && <span className="text-[10px] text-destructive">{error}</span>}
    </div>
  );
}
```

- [ ] **Step C1.2: Criar `<CommentBox>` (client)**

`src/components/satisfacao/CommentBox.tsx`:

```tsx
"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { setSatisfactionCommentAction } from "@/lib/satisfacao/actions";
import { MessageSquarePlus, Check } from "lucide-react";

interface Props {
  clientId: string;
  initialComentario: string | null;
}

export function CommentBox({ clientId, initialComentario }: Props) {
  const [open, setOpen] = useState(Boolean(initialComentario && initialComentario.length > 0));
  const [value, setValue] = useState(initialComentario ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function persist(next: string) {
    const fd = new FormData();
    fd.set("client_id", clientId);
    fd.set("comentario", next);
    startTransition(async () => {
      await setSatisfactionCommentAction(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  function onChange(next: string) {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persist(next), 1500);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <MessageSquarePlus className="h-3.5 w-3.5" />
        comentário
      </button>
    );
  }

  return (
    <div className="flex-1 max-w-md">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          persist(value);
        }}
        placeholder="Comentário (opcional)"
        rows={2}
        className="text-sm"
      />
      <div className="mt-1 flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
        {pending && <span>Salvando...</span>}
        {saved && (
          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
            <Check className="h-3 w-3" /> Salvo
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step C1.3: Criar `<EvaluationRow>` (server)**

`src/components/satisfacao/EvaluationRow.tsx`:

```tsx
import Link from "next/link";
import { ColorButtons } from "./ColorButtons";
import { CommentBox } from "./CommentBox";
import type { SatisfactionColor } from "@/lib/satisfacao/schema";

interface Props {
  clientId: string;
  clientNome: string;
  initialCor: SatisfactionColor | null;
  initialComentario: string | null;
}

function initials(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function EvaluationRow({ clientId, clientNome, initialCor, initialComentario }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
        {initials(clientNome)}
      </div>
      <Link href={`/clientes/${clientId}`} className="flex-1 min-w-0 text-sm font-medium hover:underline truncate">
        {clientNome}
      </Link>
      <ColorButtons clientId={clientId} initialCor={initialCor} />
      <CommentBox clientId={clientId} initialComentario={initialComentario} />
    </div>
  );
}
```

- [ ] **Step C1.4: Criar `<ProgressBar>` (server)**

`src/components/satisfacao/ProgressBar.tsx`:

```tsx
interface Props {
  filled: number;
  total: number;
}

export function ProgressBar({ filled, total }: Props) {
  const pct = total === 0 ? 0 : Math.round((filled / total) * 100);
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">
        Você avaliou {filled} de {total} clientes esta semana ({pct}%)
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step C1.5: Typecheck e commit**

```bash
npm run typecheck
git add src/components/satisfacao/ColorButtons.tsx \
  src/components/satisfacao/CommentBox.tsx \
  src/components/satisfacao/EvaluationRow.tsx \
  src/components/satisfacao/ProgressBar.tsx
git commit -m "feat(satisfacao): batch evaluation components with auto-save"
```

---

### Task C2: Página `/satisfacao/avaliar`

**Files:**
- Create: `src/app/(authed)/satisfacao/avaliar/page.tsx`

- [ ] **Step C2.1: Criar a página**

`src/app/(authed)/satisfacao/avaliar/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { listClientsForUser, listEntriesForUserWeek } from "@/lib/satisfacao/queries";
import { currentIsoWeek } from "@/lib/satisfacao/iso-week";
import { EvaluationRow } from "@/components/satisfacao/EvaluationRow";
import { ProgressBar } from "@/components/satisfacao/ProgressBar";

function formatWeekRange(weekIso: string): string {
  // Encontra a segunda-feira da semana ISO referenciada
  const match = weekIso.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return weekIso;
  const [, yearStr, weekStr] = match;
  const year = Number(yearStr);
  const week = Number(weekStr);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4DayNum = (jan4.getUTCDay() + 6) % 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4DayNum + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

export default async function AvaliarPage() {
  const user = await requireAuth();
  if (!canAccess(user.role, "feed:satisfaction")) notFound();

  const weekIso = currentIsoWeek();
  const clients = await listClientsForUser(user.id, user.role);

  // Bootstrap: cria entries pendentes (cor=null) pra clientes que ainda não tem
  // Roda via service-role pra garantir que insert funciona mesmo se RLS for restrito
  if (clients.length > 0) {
    const admin = createServiceRoleClient();
    const { data: existing } = await admin
      .from("satisfaction_entries")
      .select("client_id")
      .eq("autor_id", user.id)
      .eq("semana_iso", weekIso);
    const existingClientIds = new Set(((existing ?? []) as Array<{ client_id: string }>).map((e) => e.client_id));
    const missing = clients.filter((c) => !existingClientIds.has(c.id));
    if (missing.length > 0) {
      await admin.from("satisfaction_entries").insert(
        missing.map((c) => ({
          client_id: c.id,
          autor_id: user.id,
          papel_autor: user.role,
          semana_iso: weekIso,
          cor: null,
          comentario: null,
        })),
      );
    }
  }

  const entries = await listEntriesForUserWeek(user.id, weekIso);
  const entryByClient = new Map(entries.map((e) => [e.client_id, e]));
  const filled = entries.filter((e) => e.cor !== null).length;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Avaliar satisfação</h1>
        <p className="text-sm text-muted-foreground">
          Semana {weekIso} · {formatWeekRange(weekIso)}
        </p>
      </header>

      <ProgressBar filled={filled} total={clients.length} />

      {clients.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhum cliente atribuído a você.
        </p>
      ) : (
        <div className="space-y-2">
          {clients.map((c) => {
            const entry = entryByClient.get(c.id);
            return (
              <EvaluationRow
                key={c.id}
                clientId={c.id}
                clientNome={c.nome}
                initialCor={entry?.cor ?? null}
                initialComentario={entry?.comentario ?? null}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step C2.2: Typecheck e commit**

```bash
npm run typecheck
git add "src/app/(authed)/satisfacao/avaliar/page.tsx"
git commit -m "feat(satisfacao): /satisfacao/avaliar page with batch evaluation"
```

---

### Task C3: Componentes do ranking + sparkline

**Files:**
- Create: `src/components/satisfacao/SatisfactionSparkline.tsx`
- Create: `src/components/satisfacao/RankingCard.tsx`
- Create: `src/components/satisfacao/WeekSelector.tsx`
- Create: `src/components/satisfacao/OthersTable.tsx`
- Create: `src/components/satisfacao/WeeklySatisfactionDetail.tsx`

- [ ] **Step C3.1: Criar `<SatisfactionSparkline>` (server)**

`src/components/satisfacao/SatisfactionSparkline.tsx`:

```tsx
import { getSynthesisHistory } from "@/lib/satisfacao/queries";
import type { SatisfactionColor } from "@/lib/satisfacao/schema";

interface Props {
  clientId: string;
  size?: "sm" | "md";
}

const colorMap: Record<SatisfactionColor, string> = {
  verde: "bg-green-500",
  amarelo: "bg-amber-500",
  vermelho: "bg-red-500",
};

export async function SatisfactionSparkline({ clientId, size = "sm" }: Props) {
  const history = await getSynthesisHistory(clientId, 12);
  // Reverse pra mostrar mais antigo à esquerda
  const reversed = [...history].reverse();
  // Padding com vazios pra sempre ter 12 quadradinhos
  const slots: Array<{ cor: SatisfactionColor | null; semana: string | null; score: number | null }> = [];
  const missingCount = Math.max(0, 12 - reversed.length);
  for (let i = 0; i < missingCount; i++) slots.push({ cor: null, semana: null, score: null });
  for (const s of reversed) {
    slots.push({ cor: s.cor_final, semana: s.semana_iso, score: Number(s.score_final) });
  }
  const dim = size === "sm" ? "h-3 w-3" : "h-4 w-4";

  return (
    <div className="flex gap-0.5">
      {slots.map((slot, i) => (
        <span
          key={i}
          title={slot.semana ? `${slot.semana} — score ${slot.score?.toFixed(1)}` : "sem dados"}
          className={`${dim} rounded-sm ${slot.cor ? colorMap[slot.cor] : "bg-muted"}`}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step C3.2: Criar `<RankingCard>` (server)**

`src/components/satisfacao/RankingCard.tsx`:

```tsx
import Link from "next/link";
import { SatisfactionSparkline } from "./SatisfactionSparkline";
import type { SatisfactionColor } from "@/lib/satisfacao/schema";

interface Props {
  rank: number;
  clientId: string;
  clientNome: string;
  scoreFinal: number;
  corFinal: SatisfactionColor;
  acaoSugerida: string | null;
  variant: "top" | "bottom";
}

function medal(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

export function RankingCard({ rank, clientId, clientNome, scoreFinal, corFinal, acaoSugerida, variant }: Props) {
  const bgClass = variant === "top"
    ? "border-green-500/40 bg-green-500/5"
    : corFinal === "vermelho"
      ? "border-red-500/40 bg-red-500/5"
      : "border-amber-500/40 bg-amber-500/5";

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${bgClass}`}>
      <div className="flex items-center justify-between gap-2">
        <Link href={`/clientes/${clientId}/satisfacao`} className="text-sm font-medium hover:underline truncate">
          <span className="mr-2 font-bold">{medal(rank)}</span>
          {clientNome}
        </Link>
        <span className="text-sm font-semibold tabular-nums">{Number(scoreFinal).toFixed(1)}</span>
      </div>
      <SatisfactionSparkline clientId={clientId} />
      {variant === "bottom" && acaoSugerida && (
        <p className="text-[11px] text-muted-foreground line-clamp-2">{acaoSugerida}</p>
      )}
    </div>
  );
}
```

- [ ] **Step C3.3: Criar `<WeekSelector>` (client)**

`src/components/satisfacao/WeekSelector.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";

interface Props {
  current: string;
  options: string[];
}

export function WeekSelector({ current, options }: Props) {
  const router = useRouter();
  return (
    <select
      value={current}
      onChange={(e) => router.push(`/satisfacao?semana=${e.target.value}`)}
      className="h-8 rounded-md border bg-card px-2 text-sm"
    >
      {options.map((w) => (
        <option key={w} value={w}>{w}</option>
      ))}
    </select>
  );
}
```

- [ ] **Step C3.4: Criar `<OthersTable>` (client)**

`src/components/satisfacao/OthersTable.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import type { SatisfactionColor } from "@/lib/satisfacao/schema";

interface Row {
  id: string;
  client_id: string;
  cliente_nome: string;
  score_final: number;
  cor_final: SatisfactionColor;
}

const corBadge: Record<SatisfactionColor, string> = {
  verde: "bg-green-500/20 text-green-700 dark:text-green-400",
  amarelo: "bg-amber-500/20 text-amber-700 dark:text-amber-400",
  vermelho: "bg-red-500/20 text-red-700 dark:text-red-400",
};

type SortKey = "alfabetica" | "score" | "data";

export function OthersTable({ rows }: { rows: Row[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("score");

  const sorted = [...rows].sort((a, b) => {
    if (sortKey === "alfabetica") return a.cliente_nome.localeCompare(b.cliente_nome, "pt-BR");
    return Number(b.score_final) - Number(a.score_final);
  });

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Ordenar:</span>
        <button
          type="button"
          onClick={() => setSortKey("score")}
          className={sortKey === "score" ? "font-semibold text-primary" : "text-muted-foreground"}
        >
          score
        </button>
        <span className="text-muted-foreground">·</span>
        <button
          type="button"
          onClick={() => setSortKey("alfabetica")}
          className={sortKey === "alfabetica" ? "font-semibold text-primary" : "text-muted-foreground"}
        >
          alfabética
        </button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden max-h-[400px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Cliente</th>
              <th className="px-3 py-2 text-right font-medium">Score</th>
              <th className="px-3 py-2 text-left font-medium">Cor</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">
                  <Link href={`/clientes/${r.client_id}/satisfacao`} className="hover:underline">
                    {r.cliente_nome}
                  </Link>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{Number(r.score_final).toFixed(1)}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] ${corBadge[r.cor_final]}`}>
                    {r.cor_final}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step C3.5: Criar `<WeeklySatisfactionDetail>` (server)**

`src/components/satisfacao/WeeklySatisfactionDetail.tsx`:

```tsx
import { listEntriesForClientWeek } from "@/lib/satisfacao/queries";
import type { SatisfactionColor } from "@/lib/satisfacao/schema";

interface Props {
  clientId: string;
  weekIso: string;
  scoreFinal: number;
  corFinal: SatisfactionColor;
  resumoIa: string;
  divergenciaDetectada: boolean;
  acaoSugerida: string | null;
}

const colorEmoji: Record<SatisfactionColor, string> = {
  verde: "🟢",
  amarelo: "🟡",
  vermelho: "🔴",
};

export async function WeeklySatisfactionDetail({
  clientId,
  weekIso,
  scoreFinal,
  corFinal,
  resumoIa,
  divergenciaDetectada,
  acaoSugerida,
}: Props) {
  const entries = await listEntriesForClientWeek(clientId, weekIso);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span>Semana {weekIso}</span>
        <span>·</span>
        <span>{colorEmoji[corFinal]} {corFinal}</span>
        <span>·</span>
        <span className="tabular-nums">score {Number(scoreFinal).toFixed(1)}</span>
        {divergenciaDetectada && (
          <span className="ml-auto text-[11px] text-amber-600 dark:text-amber-400">⚠ divergência</span>
        )}
      </div>

      <div className="space-y-1.5 text-sm">
        {entries.filter((e) => e.cor !== null).map((e) => (
          <div key={e.id} className="text-muted-foreground">
            <span className="font-medium text-foreground">{e.papel_autor}:</span>{" "}
            {colorEmoji[e.cor!]}{" "}
            {e.comentario ?? <span className="italic">(sem comentário)</span>}
          </div>
        ))}
      </div>

      <div className="border-t pt-3 space-y-2 text-sm">
        <p>
          <span className="font-medium">Síntese IA:</span> {resumoIa}
        </p>
        {acaoSugerida && (
          <p>
            <span className="font-medium">Ação sugerida:</span> {acaoSugerida}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step C3.6: Typecheck e commit**

```bash
npm run typecheck
git add src/components/satisfacao/SatisfactionSparkline.tsx \
  src/components/satisfacao/RankingCard.tsx \
  src/components/satisfacao/WeekSelector.tsx \
  src/components/satisfacao/OthersTable.tsx \
  src/components/satisfacao/WeeklySatisfactionDetail.tsx
git commit -m "feat(satisfacao): sparkline, ranking card, week selector, others table, weekly detail"
```

---

### Task C4: Página `/satisfacao` (ranking principal)

**Files:**
- Create: `src/app/(authed)/satisfacao/page.tsx`

- [ ] **Step C4.1: Criar a página**

`src/app/(authed)/satisfacao/page.tsx`:

```tsx
import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { getSynthesisForWeek } from "@/lib/satisfacao/queries";
import { currentIsoWeek, previousIsoWeek } from "@/lib/satisfacao/iso-week";
import { RankingCard } from "@/components/satisfacao/RankingCard";
import { OthersTable } from "@/components/satisfacao/OthersTable";
import { WeekSelector } from "@/components/satisfacao/WeekSelector";

export default async function SatisfacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>;
}) {
  const params = await searchParams;
  const user = await requireAuth();

  // Default: semana com sínteses; se atual ainda vazia, usa anterior
  let weekIso = params.semana && /^\d{4}-W\d{2}$/.test(params.semana) ? params.semana : currentIsoWeek();
  let allSyntheses = await getSynthesisForWeek(weekIso);
  if (allSyntheses.length === 0 && !params.semana) {
    weekIso = previousIsoWeek(weekIso);
    allSyntheses = await getSynthesisForWeek(weekIso);
  }

  // Top 10 verde (score desc)
  const top10 = allSyntheses
    .filter((s) => s.cor_final === "verde")
    .sort((a, b) => Number(b.score_final) - Number(a.score_final))
    .slice(0, 10);

  // Bottom 10 (vermelho/amarelo, prioridade vermelho — score asc)
  const bottomCandidates = allSyntheses.filter((s) => s.cor_final === "vermelho" || s.cor_final === "amarelo");
  const bottom10 = bottomCandidates
    .sort((a, b) => {
      // Vermelhos primeiro, depois amarelos
      if (a.cor_final === "vermelho" && b.cor_final !== "vermelho") return -1;
      if (a.cor_final !== "vermelho" && b.cor_final === "vermelho") return 1;
      return Number(a.score_final) - Number(b.score_final);
    })
    .slice(0, 10);

  // Demais
  const topIds = new Set(top10.map((s) => s.id));
  const bottomIds = new Set(bottom10.map((s) => s.id));
  const others = allSyntheses
    .filter((s) => !topIds.has(s.id) && !bottomIds.has(s.id))
    .map((s) => ({
      id: s.id,
      client_id: s.client_id,
      cliente_nome: s.cliente?.nome ?? "—",
      score_final: Number(s.score_final),
      cor_final: s.cor_final,
    }));

  // Opções de seleção: últimas 12 semanas
  const weekOptions: string[] = [];
  let cursor = currentIsoWeek();
  for (let i = 0; i < 12; i++) {
    weekOptions.push(cursor);
    cursor = previousIsoWeek(cursor);
  }

  const canFeed = canAccess(user.role, "feed:satisfaction");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Satisfação</h1>
          <p className="text-sm text-muted-foreground">
            Ranking dos clientes mais e menos satisfeitos · Semana {weekIso}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <WeekSelector current={weekIso} options={weekOptions} />
          {canFeed && (
            <Link
              href="/satisfacao/avaliar"
              className="text-sm text-primary hover:underline"
            >
              Avaliar esta semana →
            </Link>
          )}
        </div>
      </header>

      {allSyntheses.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          Sem sínteses para esta semana ainda.
        </p>
      ) : (
        <>
          {top10.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-green-600 dark:text-green-400">
                Top {top10.length} mais satisfeitos
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {top10.map((s, i) => (
                  <RankingCard
                    key={s.id}
                    rank={i + 1}
                    clientId={s.client_id}
                    clientNome={s.cliente?.nome ?? "—"}
                    scoreFinal={Number(s.score_final)}
                    corFinal={s.cor_final}
                    acaoSugerida={s.acao_sugerida}
                    variant="top"
                  />
                ))}
              </div>
            </section>
          )}

          {bottom10.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">
                Top {bottom10.length} menos satisfeitos
              </h2>
              <p className="text-xs text-muted-foreground">Atenção urgente — risco de churn</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {bottom10.map((s, i) => (
                  <RankingCard
                    key={s.id}
                    rank={i + 1}
                    clientId={s.client_id}
                    clientNome={s.cliente?.nome ?? "—"}
                    scoreFinal={Number(s.score_final)}
                    corFinal={s.cor_final}
                    acaoSugerida={s.acao_sugerida}
                    variant="bottom"
                  />
                ))}
              </div>
            </section>
          )}

          {others.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Demais clientes</h2>
              <OthersTable rows={others} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step C4.2: Typecheck e commit**

```bash
npm run typecheck
git add "src/app/(authed)/satisfacao/page.tsx"
git commit -m "feat(satisfacao): /satisfacao ranking page (top/bottom/others)"
```

---

### Task C5: Aba `/clientes/[id]/satisfacao` + ClienteSidebar

**Files:**
- Create: `src/app/(authed)/clientes/[id]/satisfacao/page.tsx`
- Modify: `src/components/clientes/ClienteSidebar.tsx`

- [ ] **Step C5.1: Criar a página**

`src/app/(authed)/clientes/[id]/satisfacao/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getSynthesisHistory } from "@/lib/satisfacao/queries";
import { SatisfactionSparkline } from "@/components/satisfacao/SatisfactionSparkline";
import { WeeklySatisfactionDetail } from "@/components/satisfacao/WeeklySatisfactionDetail";

export default async function ClienteSatisfacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAuth();

  const supabase = await createClient();
  const { data: cliente } = await supabase
    .from("clients")
    .select("id, nome")
    .eq("id", id)
    .single();
  if (!cliente) notFound();

  const history = await getSynthesisHistory(id, 52); // até 1 ano

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h2 className="text-xl font-bold tracking-tight">Satisfação histórica</h2>
        <SatisfactionSparkline clientId={id} size="md" />
        <p className="text-xs text-muted-foreground">
          {history.length} {history.length === 1 ? "semana avaliada" : "semanas avaliadas"}
        </p>
      </header>

      {history.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          Sem histórico de satisfação ainda.
        </p>
      ) : (
        <div className="space-y-3">
          {history.map((s) => (
            <WeeklySatisfactionDetail
              key={s.id}
              clientId={id}
              weekIso={s.semana_iso}
              scoreFinal={Number(s.score_final)}
              corFinal={s.cor_final}
              resumoIa={s.resumo_ia}
              divergenciaDetectada={s.divergencia_detectada}
              acaoSugerida={s.acao_sugerida}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step C5.2: Atualizar `ClienteSidebar.tsx`**

Read first: `cat src/components/clientes/ClienteSidebar.tsx` para entender o array `items` atual.

Adicionar item "Satisfação" entre "Tarefas" e "Histórico". Localizar o array `items` e modificar:

```tsx
import {
  LayoutGrid, FileText, MessagesSquare, Folder, Calendar, ListChecks, History, Pencil, Smile,
} from "lucide-react";

// ... no array items, adicionar entre "tarefas" e "historico":
const items: NavItem[] = [
  { slug: "", icon: LayoutGrid, label: "Visão geral" },
  { slug: "/briefing", icon: FileText, label: "Briefing" },
  { slug: "/reunioes", icon: MessagesSquare, label: "Reuniões" },
  { slug: "/arquivos", icon: Folder, label: "Arquivos" },
  { slug: "/datas", icon: Calendar, label: "Datas importantes" },
  { slug: "/tarefas", icon: ListChecks, label: "Tarefas" },
  { slug: "/satisfacao", icon: Smile, label: "Satisfação" },
  { slug: "/historico", icon: History, label: "Histórico", privileged: true },
  { slug: "/editar", icon: Pencil, label: "Editar dados" },
];
```

- [ ] **Step C5.3: Typecheck e commit**

```bash
npm run typecheck
git add "src/app/(authed)/clientes/[id]/satisfacao/page.tsx" \
  src/components/clientes/ClienteSidebar.tsx
git commit -m "feat(satisfacao): /clientes/[id]/satisfacao tab with weekly history"
```

---

### Task C6: Substituir stub do detector pelo real (TDD)

**Files:**
- Modify: `src/lib/cron/detectors/satisfacao-pendente.ts`
- Create: `tests/unit/satisfacao-detector.test.ts`

- [ ] **Step C6.1: Escrever testes (TDD)**

Crie `tests/unit/satisfacao-detector.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());
const dispatchMock = vi.hoisted(() => vi.fn());
const synthesizeStoreMock = vi.hoisted(() => vi.fn());
const listClientsAtivosMock = vi.hoisted(() => vi.fn());
const listAssessoresMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

vi.mock("@/lib/notificacoes/dispatch", () => ({
  dispatchNotification: dispatchMock,
}));

vi.mock("@/lib/satisfacao/actions", () => ({
  synthesizeAndStore: synthesizeStoreMock,
}));

vi.mock("@/lib/satisfacao/queries", () => ({
  listClientsWithEntriesButNoSynthesis: vi.fn().mockResolvedValue(["c1", "c2"]),
}));

import { detectSatisfacaoPendente } from "@/lib/cron/detectors/satisfacao-pendente";

beforeEach(() => {
  fromMock.mockReset();
  dispatchMock.mockReset();
  synthesizeStoreMock.mockReset();
});

describe("detectSatisfacaoPendente", () => {
  it("segunda-feira: cria pendentes e dispara notificação", async () => {
    // Mock Date.now / getUTCDay() pra segunda
    vi.useFakeTimers();
    // Segunda-feira: 2026-04-13 é segunda
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 13, 12, 0, 0)));

    const insertMock = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockImplementation((table) => {
      if (table === "clients") {
        return {
          select: () => ({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: "c1", assessor_id: "a1", coordenador_id: "co1" },
                { id: "c2", assessor_id: "a1", coordenador_id: "co1" },
              ],
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: "co1", role: "coordenador" },
                { id: "a1", role: "assessor" },
              ],
            }),
          }),
        };
      }
      if (table === "satisfaction_entries") {
        return { insert: insertMock };
      }
      return {};
    });

    const counters = { satisfacao_pendente: 0 };
    await detectSatisfacaoPendente(counters);

    expect(insertMock).toHaveBeenCalled();
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ evento_tipo: "satisfacao_pendente" }),
    );
    expect(counters.satisfacao_pendente).toBeGreaterThan(0);

    vi.useRealTimers();
  });

  it("quinta-feira: roda síntese pra clientes pendentes", async () => {
    vi.useFakeTimers();
    // Quinta-feira: 2026-04-16
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 16, 12, 0, 0)));

    const counters = { satisfacao_pendente: 0 };
    await detectSatisfacaoPendente(counters);

    expect(synthesizeStoreMock).toHaveBeenCalledTimes(2);
    expect(synthesizeStoreMock).toHaveBeenCalledWith("c1", expect.any(String));
    expect(synthesizeStoreMock).toHaveBeenCalledWith("c2", expect.any(String));

    vi.useRealTimers();
  });

  it("outros dias da semana: no-op", async () => {
    vi.useFakeTimers();
    // Quarta: 2026-04-15
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 15, 12, 0, 0)));

    const counters = { satisfacao_pendente: 0 };
    await detectSatisfacaoPendente(counters);

    expect(dispatchMock).not.toHaveBeenCalled();
    expect(synthesizeStoreMock).not.toHaveBeenCalled();
    expect(counters.satisfacao_pendente).toBe(0);

    vi.useRealTimers();
  });
});
```

- [ ] **Step C6.2: Rodar testes, esperar falhar**

```bash
npm run test -- tests/unit/satisfacao-detector.test.ts
```

Esperar: testes falham (ainda usa stub no-op).

- [ ] **Step C6.3: Substituir `src/lib/cron/detectors/satisfacao-pendente.ts`**

```ts
// SERVER ONLY: do not import from client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { currentIsoWeek } from "@/lib/satisfacao/iso-week";
import { synthesizeAndStore } from "@/lib/satisfacao/actions";
import { listClientsWithEntriesButNoSynthesis } from "@/lib/satisfacao/queries";

interface ClientRow { id: string; assessor_id: string | null; coordenador_id: string | null }
interface ProfileRow { id: string; role: string }

const PRODUTORES = ["videomaker", "designer", "editor", "audiovisual_chefe"];

export async function detectSatisfacaoPendente(counters: { satisfacao_pendente: number }): Promise<void> {
  const dayOfWeek = new Date().getUTCDay(); // 0=domingo, 1=segunda, ..., 4=quinta
  const weekIso = currentIsoWeek();

  // Segunda-feira: bootstrap pendentes + notificação
  if (dayOfWeek === 1) {
    await bootstrapPendingEntriesForWeek(weekIso);
    await dispatchNotification({
      evento_tipo: "satisfacao_pendente",
      titulo: "Avaliação de satisfação pendente",
      mensagem: "Avalie seus clientes esta semana em /satisfacao/avaliar",
      link: "/satisfacao/avaliar",
    });
    counters.satisfacao_pendente++;
    return;
  }

  // Quinta-feira: força síntese pra clientes pendentes
  if (dayOfWeek === 4) {
    const clientIds = await listClientsWithEntriesButNoSynthesis(weekIso);
    for (const clientId of clientIds) {
      try {
        await synthesizeAndStore(clientId, weekIso);
      } catch (err) {
        console.error("[detector] synthesize failed for", clientId, err);
      }
    }
    return;
  }

  // Outros dias: no-op
}

async function bootstrapPendingEntriesForWeek(weekIso: string): Promise<void> {
  const supabase = createServiceRoleClient();

  // Carrega todos clientes ativos
  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, assessor_id, coordenador_id")
    .eq("status", "ativo");
  const clients = (clientsData ?? []) as ClientRow[];
  if (clients.length === 0) return;

  // Carrega todos perfis ativos elegíveis (coord, assessor, audiovisual_chefe, produtores)
  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("ativo", true);
  const profiles = (profilesData ?? []) as ProfileRow[];

  const entriesToInsert: Array<{
    client_id: string;
    autor_id: string;
    papel_autor: string;
    semana_iso: string;
    cor: null;
    comentario: null;
  }> = [];

  for (const client of clients) {
    for (const profile of profiles) {
      const isCoord = profile.role === "coordenador";
      const isAssessorDoCliente = profile.role === "assessor" && client.assessor_id === profile.id;
      const isAudiovisualOuProdutor = PRODUTORES.includes(profile.role);
      if (isCoord || isAssessorDoCliente || isAudiovisualOuProdutor) {
        entriesToInsert.push({
          client_id: client.id,
          autor_id: profile.id,
          papel_autor: profile.role,
          semana_iso: weekIso,
          cor: null,
          comentario: null,
        });
      }
    }
  }

  if (entriesToInsert.length === 0) return;

  // Insert ignora conflitos (entry pode já existir se rodou antes)
  await supabase
    .from("satisfaction_entries")
    .upsert(entriesToInsert, { onConflict: "client_id,autor_id,semana_iso", ignoreDuplicates: true });
}
```

- [ ] **Step C6.4: Rodar testes, esperar passar**

```bash
npm run test -- tests/unit/satisfacao-detector.test.ts
npm run typecheck
```

Esperar: 3/3 passa, typecheck clean.

- [ ] **Step C6.5: Commit**

```bash
git add src/lib/cron/detectors/satisfacao-pendente.ts tests/unit/satisfacao-detector.test.ts
git commit -m "feat(cron): satisfacao detector with monday bootstrap and thursday synthesis fallback"
```

---

## Bloco D — Tests E2E + push

### Task D1: E2E + push + PR

**Files:**
- Create: `tests/e2e/satisfacao.spec.ts`

- [ ] **Step D1.1: Criar test e2e**

`tests/e2e/satisfacao.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("rota /satisfacao redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/satisfacao");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /satisfacao/avaliar redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/satisfacao/avaliar");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /clientes/[id]/satisfacao redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/clientes/00000000-0000-0000-0000-000000000000/satisfacao");
  await expect(page).toHaveURL(/\/login/);
});
```

- [ ] **Step D1.2: Rodar todos os testes + typecheck**

```bash
npm run test
npm run typecheck
```

Esperar: typecheck clean. Pelo menos 17 unit tests novos da Fase 8 passam (5 iso-week + 5 synthesizer + 4 actions + 3 detector).

- [ ] **Step D1.3: Commit**

```bash
git add tests/e2e/satisfacao.spec.ts
git commit -m "test(e2e): satisfacao auth-redirect tests"
```

- [ ] **Step D1.4: Push e abrir PR**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
git push origin claude/frosty-jang-a815ff
```

```bash
/opt/homebrew/bin/gh pr create --base main --head claude/frosty-jang-a815ff \
  --title "feat: Fase 8 — Satisfação + IA (avaliação semanal + síntese Claude)" \
  --body "Implementa Fase 8 conforme spec docs/superpowers/specs/2026-04-27-fase-8-satisfacao-design.md. Usa ANTHROPIC_API_KEY (já configurada no Vercel)."
```

- [ ] **Step D1.5: Verificar Production deploy depois do merge**

```bash
/opt/homebrew/bin/gh api repos/time-yide/yide-acompanha/deployments --jq '.[0].id' \
  | xargs -I {} /opt/homebrew/bin/gh api repos/time-yide/yide-acompanha/deployments/{}/statuses
```

Esperar: `success`. **Primeiras pendências serão criadas na próxima segunda-feira às 8h BRT** pelo `daily-digest` cron.

---

## Self-Review

### Cobertura do spec — seção 5.6

| Spec | Coberto por |
|---|---|
| Tabelas `satisfaction_entries` + `satisfaction_synthesis` | A1 |
| Toda segunda cria pendências | C6 (detector segunda-feira) |
| Coord+assessor+produtores avaliam (cor + comentário) | C1 (componentes) + C2 (página avaliar) |
| Síntese IA (haiku-4-5) com prompt caching | B4 (synthesizer) |
| Real-time quando 2ª avaliação chega | B6 (action `setSatisfactionColorAction`) |
| Quinta-feira fallback | C6 (detector quinta-feira) |
| Score 0-10, cor_final, resumo, divergência, ação | B3 (schema) + B4 (synthesizer) |
| Top 10 + Bottom 10 + Demais | C4 (página `/satisfacao`) |
| Sparkline 12 semanas | C3 (`<SatisfactionSparkline>`) |
| Aba Satisfação na pasta do cliente | C5 |
| Notificação `cliente_perto_churn` (2 vermelhos seguidos) | B6 (`synthesizeAndStore` + churn check) |
| Notificação `satisfacao_pendente` (toda segunda) | C6 (detector) |
| `ANTHROPIC_API_KEY` opcional | A3 (env) |
| Avaliação manual funciona sem IA | B6 (action salva entry mesmo sem chave) |

### Lacunas conhecidas (intencionais)

- Pesquisa de satisfação enviada ao cliente final → fora do MVP
- Editar avaliação retroativa e regenerar síntese → futuro
- Resumo mensal de satisfação no dashboard → Fase 9
- Comparação histórica entre coordenadores → futuro

---

## Resumo da entrega

Após executar:

- 2 tabelas (`satisfaction_entries` + `satisfaction_synthesis`) com RLS
- IA via Claude haiku-4-5 com prompt caching (custo ~$0.50/mês)
- UI batch com auto-save instantâneo + comentário expansível com debounce
- Trigger real-time quando 2ª avaliação chega + fallback quinta no cron daily-digest
- Detector de churn (2 vermelhos seguidos → `cliente_perto_churn`)
- Página `/satisfacao` com Top 10 + Bottom 10 + Demais
- Aba `/clientes/[id]/satisfacao` com histórico semanal e sparkline
- Sidebar do cliente atualizada com link "Satisfação"
- Tests: 5 iso-week + 5 synthesizer + 4 actions + 3 detector = 17 unit + 3 e2e

Total: **~16 commits** (A1, A2, A3, B1, B2, B3, B4, B5, B6, C1, C2, C3, C4, C5, C6, D1).
