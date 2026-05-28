# FreelaYide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the FreelaYide internal panel — team picks curated extra-captação opportunities, moves them through a status pipeline, and earns points/commission with a gamified monthly ranking.

**Architecture:** New isolated module `freela-yide` (page under `/freela-yide`, lib + components folders), 2 Supabase tables (`freela_oportunidades`, `freela_metas`) with permissive RLS (permission enforced in server actions). Points are derived from timestamps in queries, not stored. Follows existing `gerador-leads`/`tarefas` patterns.

**Tech Stack:** Next.js (App Router, server actions, `after` not needed here), Supabase (service-role client for reads, cookie client for writes), Tailwind, lucide-react, vitest.

**Spec:** `docs/superpowers/specs/2026-05-28-freelayide-design.md`

---

## File structure

- Create `supabase/migrations/20260615000000_freelayide.sql` — tables + RLS + indexes
- Create `src/lib/freela-yide/tipos.ts` — status enum/defs, points constants
- Create `src/lib/freela-yide/pontos.ts` — pure logic: `calcularPontos`, `transicaoValida`
- Create `src/lib/freela-yide/frases.ts` — motivational quotes + `fraseDoDia`
- Create `src/lib/freela-yide/queries.ts` — reads (oportunidades, minhas, ranking, meta, stats)
- Create `src/lib/freela-yide/schema.ts` — zod schemas for actions
- Create `src/lib/freela-yide/actions.ts` — server actions (criar/pegar/moverStatus/excluir/definirMeta)
- Create `tests/unit/freelayide-pontos.test.ts` — unit tests for pure logic
- Create `src/components/freela-yide/OportunidadeCard.tsx`
- Create `src/components/freela-yide/OportunidadesGrid.tsx`
- Create `src/components/freela-yide/MinhasOportunidades.tsx`
- Create `src/components/freela-yide/RankingTime.tsx`
- Create `src/components/freela-yide/MetaCard.tsx`
- Create `src/components/freela-yide/NovaOportunidadeButton.tsx`
- Create `src/components/freela-yide/DefinirMetaButton.tsx`
- Create `src/components/freela-yide/FreelaHero.tsx`
- Create `src/app/(authed)/freela-yide/page.tsx`
- Modify `src/components/layout/nav-config.ts` — add link below Yori

---

### Task 1: Migration (tables + RLS)

**Files:**
- Create: `supabase/migrations/20260615000000_freelayide.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- =====================================================
-- FREELAYIDE — Painel interno de captação extra (MVP)
-- =====================================================

-- 1) Oportunidades (cada "lead" curado pra captação)
create table if not exists public.freela_oportunidades (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  titulo text not null,
  descricao text,
  cliente_nome text,
  contato text,
  valor_comissao numeric(12,2) not null default 0,

  status text not null default 'disponivel'
    check (status in ('disponivel','pega','em_negociacao','fechada','perdida')),

  pego_por uuid references public.profiles(id) on delete set null,
  pego_em timestamptz,
  negociacao_em timestamptz,
  fechada_em timestamptz,

  criado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists freela_op_org_idx
  on public.freela_oportunidades(organization_id, created_at desc)
  where deleted_at is null;
create index if not exists freela_op_pego_idx
  on public.freela_oportunidades(pego_por, pego_em desc)
  where deleted_at is null;

alter table public.freela_oportunidades enable row level security;

drop policy if exists freela_op_select on public.freela_oportunidades;
create policy freela_op_select on public.freela_oportunidades
  for select to authenticated using (true);
drop policy if exists freela_op_insert on public.freela_oportunidades;
create policy freela_op_insert on public.freela_oportunidades
  for insert to authenticated with check (true);
drop policy if exists freela_op_update on public.freela_oportunidades;
create policy freela_op_update on public.freela_oportunidades
  for update to authenticated using (true);

-- 2) Metas mensais de equipe
create table if not exists public.freela_metas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mes date not null,
  descricao text not null,
  tipo_alvo text not null default 'pontos'
    check (tipo_alvo in ('pontos','fechamentos','comissao')),
  alvo numeric(12,2) not null default 0,
  bonus_descricao text,
  criado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, mes)
);

alter table public.freela_metas enable row level security;

drop policy if exists freela_metas_select on public.freela_metas;
create policy freela_metas_select on public.freela_metas
  for select to authenticated using (true);
drop policy if exists freela_metas_insert on public.freela_metas;
create policy freela_metas_insert on public.freela_metas
  for insert to authenticated with check (true);
drop policy if exists freela_metas_update on public.freela_metas;
create policy freela_metas_update on public.freela_metas
  for update to authenticated using (true);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260615000000_freelayide.sql
git commit -m "feat(freelayide): migration tabelas oportunidades + metas"
```

> Migration é aplicada manualmente no SQL Editor após o merge (padrão do projeto). Não roda no deploy.

---

### Task 2: Tipos + lógica de pontos + frases (TDD)

**Files:**
- Create: `src/lib/freela-yide/tipos.ts`
- Create: `src/lib/freela-yide/pontos.ts`
- Create: `src/lib/freela-yide/frases.ts`
- Test: `tests/unit/freelayide-pontos.test.ts`

- [ ] **Step 1: Write `tipos.ts`**

```ts
export const STATUS_OP = ["disponivel", "pega", "em_negociacao", "fechada", "perdida"] as const;
export type StatusOp = (typeof STATUS_OP)[number];

export const STATUS_OP_DEFS: Record<StatusOp, { label: string; emoji: string; color: string }> = {
  disponivel:    { label: "Disponível",    emoji: "🟢", color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  pega:          { label: "Pega",          emoji: "🔵", color: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  em_negociacao: { label: "Em negociação", emoji: "🟡", color: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  fechada:       { label: "Fechada",       emoji: "🏆", color: "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-300" },
  perdida:       { label: "Perdida",       emoji: "⚪", color: "border-muted-foreground/30 bg-muted/40 text-muted-foreground" },
};

export const TIPO_ALVO_DEFS: Record<string, string> = {
  pontos: "pontos",
  fechamentos: "captações fechadas",
  comissao: "R$ em comissão",
};
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/unit/freelayide-pontos.test.ts
import { describe, it, expect } from "vitest";
import { calcularPontos, transicaoValida } from "@/lib/freela-yide/pontos";

describe("calcularPontos", () => {
  it("disponível = 0", () => {
    expect(calcularPontos({ status: "disponivel", negociacao_em: null, fechada_em: null, valor_comissao: 600 })).toBe(0);
  });
  it("pega = 5", () => {
    expect(calcularPontos({ status: "pega", negociacao_em: null, fechada_em: null, valor_comissao: 600 })).toBe(5);
  });
  it("em negociação = 5 + 10", () => {
    expect(calcularPontos({ status: "em_negociacao", negociacao_em: "2026-05-01", fechada_em: null, valor_comissao: 600 })).toBe(15);
  });
  it("fechada com negociação = 5 + 10 + 50 + floor(600/50)=12 => 77", () => {
    expect(calcularPontos({ status: "fechada", negociacao_em: "2026-05-01", fechada_em: "2026-05-02", valor_comissao: 600 })).toBe(77);
  });
  it("fechada sem ter passado por negociação = 5 + 50 + 12 => 67", () => {
    expect(calcularPontos({ status: "fechada", negociacao_em: null, fechada_em: "2026-05-02", valor_comissao: 600 })).toBe(67);
  });
  it("perdida = 5 (pegou) sem bônus de fechar", () => {
    expect(calcularPontos({ status: "perdida", negociacao_em: null, fechada_em: null, valor_comissao: 600 })).toBe(5);
  });
});

describe("transicaoValida", () => {
  it("disponivel -> pega ok", () => expect(transicaoValida("disponivel", "pega")).toBe(true));
  it("pega -> fechada ok", () => expect(transicaoValida("pega", "fechada")).toBe(true));
  it("disponivel -> fechada inválido", () => expect(transicaoValida("disponivel", "fechada")).toBe(false));
  it("fechada -> qualquer inválido", () => expect(transicaoValida("fechada", "pega")).toBe(false));
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/freelayide-pontos.test.ts`
Expected: FAIL (module `pontos` not found)

- [ ] **Step 4: Write `pontos.ts`**

```ts
import type { StatusOp } from "./tipos";

export const PONTOS = { pegar: 5, negociacao: 10, fechar: 50, porReal: 50 } as const;

export interface OportunidadePontos {
  status: StatusOp;
  negociacao_em: string | null;
  fechada_em: string | null;
  valor_comissao: number;
}

/** Pontos derivados do progresso da oportunidade. Acumulativo. */
export function calcularPontos(o: OportunidadePontos): number {
  let p = 0;
  if (o.status !== "disponivel") p += PONTOS.pegar; // pegou
  if (o.negociacao_em) p += PONTOS.negociacao;
  if (o.status === "fechada") {
    p += PONTOS.fechar + Math.floor((o.valor_comissao ?? 0) / PONTOS.porReal);
  }
  return p;
}

const TRANSICOES: Record<StatusOp, StatusOp[]> = {
  disponivel: ["pega"],
  pega: ["em_negociacao", "fechada", "perdida", "disponivel"],
  em_negociacao: ["fechada", "perdida", "pega"],
  fechada: [],
  perdida: ["disponivel"],
};

export function transicaoValida(de: StatusOp, para: StatusOp): boolean {
  return TRANSICOES[de]?.includes(para) ?? false;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/freelayide-pontos.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 6: Write `frases.ts`**

```ts
const FRASES = [
  "Cada oportunidade pega é dinheiro na mesa. Vai buscar. 💸",
  "Quem corre atrás, fecha. Quem espera, assiste. 🏆",
  "Seu próximo contrato tá num card aí em cima. 🎯",
  "Performance não é sorte, é repetição. 🔥",
  "O ranking não mente: bora subir. 📈",
  "Comissão boa é a que você fechou hoje. 🤑",
  "Time que capta junto, cresce junto. 🚀",
  "Não existe lead pequeno pra quem pensa grande. 💪",
];

/** Frase estável por dia (não muda a cada refresh do mesmo dia). */
export function fraseDoDia(d: Date = new Date()): string {
  const dia = Math.floor(d.getTime() / 86_400_000);
  return FRASES[dia % FRASES.length];
}
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/freela-yide/tipos.ts src/lib/freela-yide/pontos.ts src/lib/freela-yide/frases.ts tests/unit/freelayide-pontos.test.ts
git commit -m "feat(freelayide): tipos, lógica de pontos (TDD) e frases"
```

---

### Task 3: Queries (reads)

**Files:**
- Create: `src/lib/freela-yide/queries.ts`

- [ ] **Step 1: Write `queries.ts`**

```ts
// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { calcularPontos } from "./pontos";
import type { StatusOp } from "./tipos";

export interface OportunidadeRow {
  id: string;
  titulo: string;
  descricao: string | null;
  cliente_nome: string | null;
  contato: string | null;
  valor_comissao: number;
  status: StatusOp;
  pego_por: string | null;
  pego_por_nome: string | null;
  pego_em: string | null;
  negociacao_em: string | null;
  fechada_em: string | null;
  created_at: string;
  pontos: number;
}

export interface MetaRow {
  id: string;
  mes: string;
  descricao: string;
  tipo_alvo: "pontos" | "fechamentos" | "comissao";
  alvo: number;
  bonus_descricao: string | null;
}

export interface RankingEntry {
  user_id: string;
  nome: string;
  pontos: number;
  fechamentos: number;
  comissao: number;
}

export interface FreelaStats {
  disponiveis: number;
  comissaoEmJogo: number;   // soma valor_comissao das disponíveis
  ganhoNoMes: number;       // comissão de fechadas no mês (por pego_em) do usuário
  meusPontos: number;
  meuRank: number | null;
  totalNoRanking: number;
}

const SELECT =
  "id, titulo, descricao, cliente_nome, contato, valor_comissao, status, pego_por, pego_em, negociacao_em, fechada_em, created_at, responsavel:profiles!freela_oportunidades_pego_por_fkey(nome)";

function mapRow(row: Record<string, unknown>): OportunidadeRow {
  const status = row.status as StatusOp;
  const valor_comissao = Number(row.valor_comissao ?? 0);
  const base = {
    id: row.id as string,
    titulo: row.titulo as string,
    descricao: (row.descricao as string | null) ?? null,
    cliente_nome: (row.cliente_nome as string | null) ?? null,
    contato: (row.contato as string | null) ?? null,
    valor_comissao,
    status,
    pego_por: (row.pego_por as string | null) ?? null,
    pego_por_nome: ((row.responsavel as { nome?: string } | null) ?? null)?.nome ?? null,
    pego_em: (row.pego_em as string | null) ?? null,
    negociacao_em: (row.negociacao_em as string | null) ?? null,
    fechada_em: (row.fechada_em as string | null) ?? null,
    created_at: row.created_at as string,
  };
  return { ...base, pontos: calcularPontos({ status, negociacao_em: base.negociacao_em, fechada_em: base.fechada_em, valor_comissao }) };
}

function inicioDoMes(d = new Date()): string {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

export async function getOrganizationId(userId: string): Promise<string | null> {
  const sb = createServiceRoleClient() as unknown as { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data } = await sb.from("profiles").select("organization_id").eq("id", userId).maybeSingle();
  return ((data as { organization_id?: string } | null) ?? null)?.organization_id ?? null;
}

export async function listOportunidades(orgId: string, apenasDisponiveis = false): Promise<OportunidadeRow[]> {
  const sb = createServiceRoleClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  let q = sb.from("freela_oportunidades").select(SELECT).eq("organization_id", orgId).is("deleted_at", null);
  if (apenasDisponiveis) q = q.eq("status", "disponivel");
  q = q.order("created_at", { ascending: false });
  const { data, error } = await q;
  if (error) { console.error("[freelayide] listOportunidades", error.message); return []; }
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapRow);
}

export async function listMinhas(orgId: string, userId: string): Promise<OportunidadeRow[]> {
  const sb = createServiceRoleClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data, error } = await sb
    .from("freela_oportunidades").select(SELECT)
    .eq("organization_id", orgId).eq("pego_por", userId).is("deleted_at", null)
    .order("pego_em", { ascending: false });
  if (error) { console.error("[freelayide] listMinhas", error.message); return []; }
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapRow);
}

export async function getMetaAtual(orgId: string): Promise<MetaRow | null> {
  const sb = createServiceRoleClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const mesIso = inicioDoMes().slice(0, 10);
  const { data } = await sb.from("freela_metas").select("id, mes, descricao, tipo_alvo, alvo, bonus_descricao")
    .eq("organization_id", orgId).eq("mes", mesIso).maybeSingle();
  return (data as MetaRow | null) ?? null;
}

/** Ranking do mês corrente: pontos por pessoa, oportunidades PEGAS no mês. */
export async function getRanking(orgId: string): Promise<RankingEntry[]> {
  const sb = createServiceRoleClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data } = await sb.from("freela_oportunidades")
    .select("pego_por, status, negociacao_em, fechada_em, valor_comissao, responsavel:profiles!freela_oportunidades_pego_por_fkey(nome)")
    .eq("organization_id", orgId).is("deleted_at", null)
    .not("pego_por", "is", null).gte("pego_em", inicioDoMes());
  const mapa = new Map<string, RankingEntry>();
  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    const uid = r.pego_por as string;
    const nome = ((r.responsavel as { nome?: string } | null) ?? null)?.nome ?? "—";
    const status = r.status as StatusOp;
    const valor = Number(r.valor_comissao ?? 0);
    const pts = calcularPontos({ status, negociacao_em: (r.negociacao_em as string | null) ?? null, fechada_em: (r.fechada_em as string | null) ?? null, valor_comissao: valor });
    const cur = mapa.get(uid) ?? { user_id: uid, nome, pontos: 0, fechamentos: 0, comissao: 0 };
    cur.pontos += pts;
    if (status === "fechada") { cur.fechamentos += 1; cur.comissao += valor; }
    mapa.set(uid, cur);
  }
  return [...mapa.values()].sort((a, b) => b.pontos - a.pontos);
}

export async function getStats(orgId: string, userId: string): Promise<FreelaStats> {
  const [todas, ranking] = await Promise.all([listOportunidades(orgId), getRanking(orgId)]);
  const disponiveis = todas.filter((o) => o.status === "disponivel");
  const idx = ranking.findIndex((r) => r.user_id === userId);
  const eu = idx >= 0 ? ranking[idx] : null;
  return {
    disponiveis: disponiveis.length,
    comissaoEmJogo: disponiveis.reduce((s, o) => s + o.valor_comissao, 0),
    ganhoNoMes: eu?.comissao ?? 0,
    meusPontos: eu?.pontos ?? 0,
    meuRank: idx >= 0 ? idx + 1 : null,
    totalNoRanking: ranking.length,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors)

- [ ] **Step 3: Commit**

```bash
git add src/lib/freela-yide/queries.ts
git commit -m "feat(freelayide): queries (oportunidades, minhas, ranking, meta, stats)"
```

---

### Task 4: Schema + Server actions

**Files:**
- Create: `src/lib/freela-yide/schema.ts`
- Create: `src/lib/freela-yide/actions.ts`

- [ ] **Step 1: Write `schema.ts`**

```ts
import { z } from "zod";
import { STATUS_OP } from "./tipos";

const uuid = z.string().uuid();

export const criarOportunidadeSchema = z.object({
  titulo: z.string().trim().min(2).max(160),
  descricao: z.string().trim().max(2000).optional().nullable(),
  cliente_nome: z.string().trim().max(160).optional().nullable(),
  contato: z.string().trim().max(160).optional().nullable(),
  valor_comissao: z.coerce.number().min(0).max(1_000_000),
});

export const moverStatusSchema = z.object({
  id: uuid,
  status: z.enum(STATUS_OP),
});

export const definirMetaSchema = z.object({
  descricao: z.string().trim().min(2).max(200),
  tipo_alvo: z.enum(["pontos", "fechamentos", "comissao"]),
  alvo: z.coerce.number().min(0).max(10_000_000),
  bonus_descricao: z.string().trim().max(300).optional().nullable(),
});

export type CriarOportunidadeInput = z.infer<typeof criarOportunidadeSchema>;
```

- [ ] **Step 2: Write `actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { transicaoValida } from "./pontos";
import type { StatusOp } from "./tipos";
import { criarOportunidadeSchema, moverStatusSchema, definirMetaSchema } from "./schema";

interface Ok { success: true }
interface Err { error: string }
type Result = Ok | Err;

const ROLES_GESTAO = ["adm", "socio"] as const;
function isGestao(role: string): boolean { return (ROLES_GESTAO as readonly string[]).includes(role); }

function fd(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

async function orgIdDo(userId: string, sb: ReturnType<typeof createClient> extends Promise<infer C> ? C : never): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any).from("profiles").select("organization_id").eq("id", userId).single();
  return (data as { organization_id?: string } | null)?.organization_id ?? null;
}

export async function criarOportunidadeAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  if (!isGestao(actor.role)) return { error: "Sem permissão" };
  const parsed = criarOportunidadeSchema.safeParse({
    titulo: fd(formData, "titulo"),
    descricao: fd(formData, "descricao"),
    cliente_nome: fd(formData, "cliente_nome"),
    contato: fd(formData, "contato"),
    valor_comissao: fd(formData, "valor_comissao") ?? 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const orgId = await orgIdDo(actor.id, supabase);
  if (!orgId) return { error: "Organização não encontrada" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("freela_oportunidades").insert({
    organization_id: orgId,
    criado_por: actor.id,
    titulo: parsed.data.titulo,
    descricao: parsed.data.descricao,
    cliente_nome: parsed.data.cliente_nome,
    contato: parsed.data.contato,
    valor_comissao: parsed.data.valor_comissao,
    status: "disponivel",
  });
  if (error) return { error: error.message };
  revalidatePath("/freela-yide");
  return { success: true };
}

export async function pegarOportunidadeAction(id: string): Promise<Result> {
  const actor = await requireAuth();
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: op } = await sb.from("freela_oportunidades").select("status, pego_por").eq("id", id).single();
  if (!op) return { error: "Oportunidade não encontrada" };
  if (op.status !== "disponivel") return { error: "Essa oportunidade já foi pega" };

  const { data: upd, error } = await sb.from("freela_oportunidades")
    .update({ status: "pega", pego_por: actor.id, pego_em: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id).eq("status", "disponivel").select("id");
  if (error) return { error: error.message };
  if (!upd || upd.length === 0) return { error: "Alguém pegou primeiro" }; // corrida (RLS update silencioso)
  revalidatePath("/freela-yide");
  return { success: true };
}

export async function moverStatusAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  const parsed = moverStatusSchema.safeParse({ id: fd(formData, "id"), status: fd(formData, "status") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const novo = parsed.data.status as StatusOp;

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: op } = await sb.from("freela_oportunidades").select("status, pego_por").eq("id", parsed.data.id).single();
  if (!op) return { error: "Oportunidade não encontrada" };

  const ehDono = op.pego_por === actor.id;
  if (!ehDono && !isGestao(actor.role)) return { error: "Só quem pegou (ou adm/sócio) pode mover" };
  if (!transicaoValida(op.status as StatusOp, novo)) return { error: "Transição inválida" };

  const patch: Record<string, unknown> = { status: novo, updated_at: new Date().toISOString() };
  if (novo === "em_negociacao") patch.negociacao_em = new Date().toISOString();
  if (novo === "fechada") patch.fechada_em = new Date().toISOString();
  if (novo === "disponivel") { patch.pego_por = null; patch.pego_em = null; patch.negociacao_em = null; patch.fechada_em = null; }

  const { error } = await sb.from("freela_oportunidades").update(patch).eq("id", parsed.data.id);
  if (error) return { error: error.message };
  revalidatePath("/freela-yide");
  return { success: true };
}

export async function excluirOportunidadeAction(id: string): Promise<Result> {
  const actor = await requireAuth();
  if (!isGestao(actor.role)) return { error: "Sem permissão" };
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("freela_oportunidades")
    .update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/freela-yide");
  return { success: true };
}

export async function definirMetaAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  if (!isGestao(actor.role)) return { error: "Sem permissão" };
  const parsed = definirMetaSchema.safeParse({
    descricao: fd(formData, "descricao"),
    tipo_alvo: fd(formData, "tipo_alvo"),
    alvo: fd(formData, "alvo") ?? 0,
    bonus_descricao: fd(formData, "bonus_descricao"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const orgId = await orgIdDo(actor.id, supabase);
  if (!orgId) return { error: "Organização não encontrada" };
  const mes = new Date();
  const mesIso = new Date(mes.getFullYear(), mes.getMonth(), 1).toISOString().slice(0, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("freela_metas").upsert({
    organization_id: orgId, mes: mesIso, criado_por: actor.id,
    descricao: parsed.data.descricao, tipo_alvo: parsed.data.tipo_alvo,
    alvo: parsed.data.alvo, bonus_descricao: parsed.data.bonus_descricao,
    updated_at: new Date().toISOString(),
  }, { onConflict: "organization_id,mes" });
  if (error) return { error: error.message };
  revalidatePath("/freela-yide");
  return { success: true };
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/freela-yide/schema.ts src/lib/freela-yide/actions.ts
git commit -m "feat(freelayide): schema zod + server actions (criar/pegar/mover/excluir/meta)"
```

---

### Task 5: Link no menu (abaixo do Yori)

**Files:**
- Modify: `src/components/layout/nav-config.ts`

- [ ] **Step 1: Add `Zap` to the lucide import block** (the file imports icons from `lucide-react` near the top — add `Zap` to that list).

- [ ] **Step 2: Insert the link right after the Yori entry**

Find the line:
```ts
      { type: "link", href: "/audiovisual/yori", icon: Sparkles, label: "Yori", roles: ["videomaker", "editor", "audiovisual_chefe", "assessor", "socio", "adm"], badgeKey: "yoriProntos" },
```
Add immediately below it:
```ts
      { type: "link", href: "/freela-yide", icon: Zap, label: "FreelaYide", roles: ["adm", "socio", "comercial", "coordenador", "assessor", "designer", "videomaker", "editor", "audiovisual_chefe"], badgeKey: null },
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/nav-config.ts
git commit -m "feat(freelayide): link no menu abaixo do Yori"
```

---

### Task 6: Componentes + página

> Identidade Electric Hype: gradiente de marca `from-violet-600 to-cyan-400`; valores em R$ com `text-fuchsia-400`/`text-fuchsia-300`; números com `tabular-nums`.

**Files:**
- Create all `src/components/freela-yide/*.tsx` + `src/app/(authed)/freela-yide/page.tsx`

- [ ] **Step 1: `OportunidadeCard.tsx`**

```tsx
"use client";
import { useTransition } from "react";
import { Coins, Flame, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { STATUS_OP_DEFS } from "@/lib/freela-yide/tipos";
import { pegarOportunidadeAction } from "@/lib/freela-yide/actions";
import type { OportunidadeRow } from "@/lib/freela-yide/queries";
import { useRouter } from "next/navigation";

export function OportunidadeCard({ op }: { op: OportunidadeRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const def = STATUS_OP_DEFS[op.status];
  function pegar() {
    start(async () => {
      const r = await pegarOportunidadeAction(op.id);
      if ("error" in r) { alert(r.error); return; }
      router.refresh();
    });
  }
  return (
    <Card className="flex flex-col gap-3 p-4 ring-1 ring-violet-500/20 hover:ring-violet-500/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{op.titulo}</p>
          {op.cliente_nome && <p className="truncate text-xs text-muted-foreground">{op.cliente_nome}</p>}
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${def.color}`}>{def.emoji} {def.label}</span>
      </div>
      {op.descricao && <p className="line-clamp-2 text-xs text-muted-foreground">{op.descricao}</p>}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-2xl font-bold tabular-nums text-fuchsia-400">
          <Coins className="h-5 w-5" /> R$ {op.valor_comissao.toLocaleString("pt-BR")}
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground"><Flame className="h-3.5 w-3.5 text-orange-400" /> +{op.pontos} pts</span>
      </div>
      {op.status === "disponivel" && (
        <button onClick={pegar} disabled={pending}
          className="inline-flex items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-400 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pegar oportunidade"}
        </button>
      )}
      {op.status !== "disponivel" && op.pego_por_nome && (
        <p className="text-[11px] text-muted-foreground">Com <strong className="text-foreground">{op.pego_por_nome}</strong></p>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: `OportunidadesGrid.tsx`**

```tsx
import { Card } from "@/components/ui/card";
import { OportunidadeCard } from "./OportunidadeCard";
import type { OportunidadeRow } from "@/lib/freela-yide/queries";

export function OportunidadesGrid({ ops }: { ops: OportunidadeRow[] }) {
  if (ops.length === 0) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">Nenhuma oportunidade disponível agora. 👀</Card>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {ops.map((op) => <OportunidadeCard key={op.id} op={op} />)}
    </div>
  );
}
```

- [ ] **Step 3: `MinhasOportunidades.tsx`**

```tsx
"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { STATUS_OP_DEFS } from "@/lib/freela-yide/tipos";
import { moverStatusAction } from "@/lib/freela-yide/actions";
import type { OportunidadeRow } from "@/lib/freela-yide/queries";

const PROXIMOS: Record<string, { status: string; label: string }[]> = {
  pega: [{ status: "em_negociacao", label: "🤝 Negociando" }, { status: "fechada", label: "🏆 Fechei!" }, { status: "perdida", label: "Perdi" }, { status: "disponivel", label: "Devolver" }],
  em_negociacao: [{ status: "fechada", label: "🏆 Fechei!" }, { status: "perdida", label: "Perdi" }],
};

export function MinhasOportunidades({ ops }: { ops: OportunidadeRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (ops.length === 0) return <Card className="p-6 text-center text-sm text-muted-foreground">Você ainda não pegou nenhuma. Bora! 🚀</Card>;
  function mover(id: string, status: string) {
    const f = new FormData(); f.set("id", id); f.set("status", status);
    start(async () => { const r = await moverStatusAction(f); if ("error" in r) { alert(r.error); return; } router.refresh(); });
  }
  return (
    <div className="space-y-2">
      {ops.map((op) => {
        const def = STATUS_OP_DEFS[op.status];
        const acoes = PROXIMOS[op.status] ?? [];
        return (
          <Card key={op.id} className="flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{op.titulo}</p>
              <p className="text-xs text-muted-foreground">{def.emoji} {def.label} · <span className="text-fuchsia-400 font-semibold">R$ {op.valor_comissao.toLocaleString("pt-BR")}</span> · +{op.pontos} pts</p>
            </div>
            <div className="flex flex-wrap gap-1">
              {acoes.map((a) => (
                <button key={a.status} onClick={() => mover(op.id, a.status)} disabled={pending}
                  className="rounded-md border bg-card px-2 py-1 text-[11px] hover:bg-muted disabled:opacity-50">{a.label}</button>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: `RankingTime.tsx`**

```tsx
import { Card } from "@/components/ui/card";
import type { RankingEntry } from "@/lib/freela-yide/queries";

const MEDALHA = ["🥇", "🥈", "🥉"];

export function RankingTime({ ranking, meId }: { ranking: RankingEntry[]; meId: string }) {
  if (ranking.length === 0) return <Card className="p-6 text-center text-sm text-muted-foreground">Ranking começa quando alguém pegar a primeira oportunidade do mês. 🏆</Card>;
  return (
    <div className="space-y-1.5">
      {ranking.map((r, i) => (
        <Card key={r.user_id} className={`flex items-center gap-3 p-3 ${r.user_id === meId ? "ring-1 ring-violet-500/50" : ""}`}>
          <span className="w-7 text-center text-lg font-bold tabular-nums">{MEDALHA[i] ?? `${i + 1}º`}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{r.nome}{r.user_id === meId && <span className="text-violet-400"> (você)</span>}</p>
            <p className="text-[11px] text-muted-foreground">{r.fechamentos} fechada(s) · R$ {r.comissao.toLocaleString("pt-BR")}</p>
          </div>
          <span className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-400 px-3 py-1 text-xs font-bold text-white tabular-nums">{r.pontos} pts</span>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: `MetaCard.tsx`**

```tsx
import { Card } from "@/components/ui/card";
import { Gift } from "lucide-react";
import type { MetaRow, RankingEntry } from "@/lib/freela-yide/queries";
import { TIPO_ALVO_DEFS } from "@/lib/freela-yide/tipos";

export function MetaCard({ meta, ranking }: { meta: MetaRow | null; ranking: RankingEntry[] }) {
  if (!meta) return null;
  const total = ranking.reduce((s, r) => {
    if (meta.tipo_alvo === "pontos") return s + r.pontos;
    if (meta.tipo_alvo === "fechamentos") return s + r.fechamentos;
    return s + r.comissao;
  }, 0);
  const pct = meta.alvo > 0 ? Math.min(100, Math.round((total / meta.alvo) * 100)) : 0;
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Gift className="h-4 w-4 text-fuchsia-400" /> Meta do mês</h2>
        {meta.bonus_descricao && <span className="rounded-full bg-fuchsia-500/10 px-2 py-0.5 text-[11px] font-medium text-fuchsia-400">🎁 {meta.bonus_descricao}</span>}
      </div>
      <p className="text-sm">{meta.descricao}</p>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-400" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-muted-foreground tabular-nums">
        {total.toLocaleString("pt-BR")} / {meta.alvo.toLocaleString("pt-BR")} {TIPO_ALVO_DEFS[meta.tipo_alvo]} ({pct}%)
      </p>
    </Card>
  );
}
```

- [ ] **Step 6: `NovaOportunidadeButton.tsx`** (modal simples com `<dialog>`-style state)

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { criarOportunidadeAction } from "@/lib/freela-yide/actions";

export function NovaOportunidadeButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function submit(formData: FormData) {
    setError(null);
    start(async () => {
      const r = await criarOportunidadeAction(formData);
      if ("error" in r) { setError(r.error); return; }
      setOpen(false); router.refresh();
    });
  }
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nova oportunidade</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <form action={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-xl border bg-card p-5">
            <h2 className="font-semibold">Nova oportunidade ⚡</h2>
            <div className="space-y-1.5"><Label htmlFor="titulo">Título</Label><Input id="titulo" name="titulo" required maxLength={160} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="cliente_nome">Cliente</Label><Input id="cliente_nome" name="cliente_nome" /></div>
              <div className="space-y-1.5"><Label htmlFor="valor_comissao">Comissão (R$)</Label><Input id="valor_comissao" name="valor_comissao" type="number" min={0} step="50" required /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="contato">Contato</Label><Input id="contato" name="contato" placeholder="telefone, @, e-mail..." /></div>
            <div className="space-y-1.5"><Label htmlFor="descricao">Descrição</Label><Textarea id="descricao" name="descricao" rows={3} /></div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Publicar"}</Button></div>
          </form>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 7: `DefinirMetaButton.tsx`** (mesmo padrão de modal)

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { definirMetaAction } from "@/lib/freela-yide/actions";

export function DefinirMetaButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function submit(formData: FormData) {
    setError(null);
    start(async () => { const r = await definirMetaAction(formData); if ("error" in r) { setError(r.error); return; } setOpen(false); router.refresh(); });
  }
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Target className="h-4 w-4" /> Meta do mês</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <form action={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-xl border bg-card p-5">
            <h2 className="font-semibold">Meta do mês 🎯</h2>
            <div className="space-y-1.5"><Label htmlFor="descricao">Descrição</Label><Input id="descricao" name="descricao" required placeholder="Fechar 10 captações" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="tipo_alvo">Tipo</Label>
                <select id="tipo_alvo" name="tipo_alvo" className="h-9 w-full rounded-md border bg-card px-2 text-sm">
                  <option value="fechamentos">Fechamentos</option><option value="pontos">Pontos</option><option value="comissao">R$ comissão</option>
                </select></div>
              <div className="space-y-1.5"><Label htmlFor="alvo">Alvo</Label><Input id="alvo" name="alvo" type="number" min={0} required /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="bonus_descricao">Bônus</Label><Input id="bonus_descricao" name="bonus_descricao" placeholder="R$ 500 pro 1º lugar" /></div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar meta"}</Button></div>
          </form>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 8: `FreelaHero.tsx`**

```tsx
import { fraseDoDia } from "@/lib/freela-yide/frases";
import type { FreelaStats } from "@/lib/freela-yide/queries";

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-white/50">{label}</p>
      <p className="text-2xl font-extrabold tabular-nums text-white">{value}</p>
      <p className="text-[11px] text-white/60">{sub}</p>
    </div>
  );
}

export function FreelaHero({ stats }: { stats: FreelaStats }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 p-6"
      style={{ background: "radial-gradient(120% 140% at 0% 0%, rgba(124,58,237,.30), transparent 55%), radial-gradient(120% 140% at 100% 0%, rgba(34,211,238,.20), transparent 55%), linear-gradient(180deg,#0b0a14,#120e1f)" }}>
      <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/40 bg-violet-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-violet-200">⚡ Captação extra</div>
      <h1 className="mt-3 bg-gradient-to-r from-white via-violet-200 to-cyan-300 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent">FreelaYide 💸</h1>
      <p className="mt-1 text-sm text-white/70">{fraseDoDia()}</p>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Disponíveis" value={String(stats.disponiveis)} sub="oportunidades 🎯" />
        <Stat label="Em jogo" value={`R$ ${stats.comissaoEmJogo.toLocaleString("pt-BR")}`} sub="comissão potencial 🤑" />
        <Stat label="Você ganhou" value={`R$ ${stats.ganhoNoMes.toLocaleString("pt-BR")}`} sub="este mês 📈" />
        <Stat label="Seu rank" value={stats.meuRank ? `#${stats.meuRank}` : "—"} sub={`${stats.meusPontos} pts 🏆`} />
      </div>
    </div>
  );
}
```

- [ ] **Step 9: `page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId, listOportunidades, listMinhas, getRanking, getMetaAtual, getStats } from "@/lib/freela-yide/queries";
import { FreelaHero } from "@/components/freela-yide/FreelaHero";
import { MetaCard } from "@/components/freela-yide/MetaCard";
import { OportunidadesGrid } from "@/components/freela-yide/OportunidadesGrid";
import { MinhasOportunidades } from "@/components/freela-yide/MinhasOportunidades";
import { RankingTime } from "@/components/freela-yide/RankingTime";
import { NovaOportunidadeButton } from "@/components/freela-yide/NovaOportunidadeButton";
import { DefinirMetaButton } from "@/components/freela-yide/DefinirMetaButton";

const ALLOWED = ["adm", "socio", "comercial", "coordenador", "assessor", "designer", "videomaker", "editor", "audiovisual_chefe"];
const GESTAO = ["adm", "socio"];

export default async function FreelaYidePage() {
  const user = await requireAuth();
  if (!ALLOWED.includes(user.role)) notFound();
  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();

  const [todas, minhas, ranking, meta, stats] = await Promise.all([
    listOportunidades(orgId, true),
    listMinhas(orgId, user.id),
    getRanking(orgId),
    getMetaAtual(orgId),
    getStats(orgId, user.id),
  ]);
  const gestao = GESTAO.includes(user.role);

  return (
    <div className="space-y-6">
      <FreelaHero stats={stats} />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">🎯 Oportunidades disponíveis</h2>
              {gestao && <NovaOportunidadeButton />}
            </div>
            <OportunidadesGrid ops={todas} />
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">🙋 Minhas oportunidades</h2>
            <MinhasOportunidades ops={minhas} />
          </section>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">🏆 Ranking do mês</h2>
            {gestao && <DefinirMetaButton />}
          </div>
          <MetaCard meta={meta} ranking={ranking} />
          <RankingTime ranking={ranking} meId={user.id} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Typecheck + lint**

Run: `npm run typecheck && npx eslint src/components/freela-yide "src/app/(authed)/freela-yide" src/lib/freela-yide`
Expected: PASS, 0 errors

- [ ] **Step 11: Commit**

```bash
git add src/components/freela-yide src/app/\(authed\)/freela-yide
git commit -m "feat(freelayide): página + componentes (hero, oportunidades, minhas, ranking, meta, modais)"
```

---

### Task 7: Verificação final

- [ ] **Step 1: Full typecheck + lint + tests**

Run: `npm run typecheck && npm run lint && npm test`
Expected: typecheck clean; lint 0 errors; tests pass (incl. freelayide-pontos).

- [ ] **Step 2: Push + PR**

```bash
git push -u origin feat/freela-yide
gh pr create --base main --title "feat(freelayide): painel interno de captação extra (MVP)" --body "..."
```

PR body deve avisar: **migration manual** `20260615000000_freelayide.sql` (rodar no SQL Editor após merge) — senão a página dá erro de tabela inexistente.

---

## Notas de verificação (self-review)

- **Cobertura do spec:** hero+stats ✅(T6), oportunidades disponíveis + nova ✅(T6/T4), minhas+status ✅, ranking por pontos ✅(T3/T6), meta+bônus+progresso ✅, frases ✅(T2), tabelas+RLS ✅(T1), permissões adm/sócio ✅(T4), link abaixo do Yori ✅(T5). Notion/organização diária = doc-only no spec (sem tarefa de código). Comissão real / leads / notificações = fora de escopo (fase 2).
- **FK name:** o select usa `profiles!freela_oportunidades_pego_por_fkey` — nome derivado da coluna `pego_por references profiles`. Se o Postgres nomear diferente, ajustar pro nome real do constraint (checar com `\d freela_oportunidades` após migration).
- **RLS update silencioso:** `pegarOportunidade` usa `.select("id")` + checa length pra detectar corrida/`0 rows` (padrão do projeto).
