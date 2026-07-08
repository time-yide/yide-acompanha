# Módulo E-commerce — Painel de anúncios por assessor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um módulo `/ecommerce` onde o assessor de e-commerce registra quantos anúncios (listagens de marketplace) subiu por cliente, com painel consolidado para a chefia.

**Architecture:** Espelha o módulo Visitas — tabela própria (`anuncios_ecommerce`) com `organization_id` + `colaborador_id`, RLS permissiva (`using true`) e separação por papel na camada de query. Cliente e-commerce = `clients.tipo_pacote = 'ecommerce'` (já existe, sem migration de cliente). Agregações do painel numa função pura testável. Página server-component com abas e filtros via searchParams.

**Tech Stack:** Next.js (App Router), Supabase (service-role client), Zod, Vitest, Tailwind + componentes `@/components/ui/*`.

**Referências de padrão:** `src/lib/visitas/{schema,queries,actions}.ts`, `src/app/(authed)/visitas/page.tsx`, `src/components/visitas/NovaVisitaButton.tsx`, `src/lib/auth/permissions.ts`, `src/components/layout/nav-config.ts`.

**Aprendizados a respeitar (memória do projeto):**
- `unstable_cache` só com service-role — aqui usamos `createServiceRoleClient()` direto, sem cache.
- RLS permissiva torna `.update()` silencioso → checar rows via `.select()`.
- Migrations são aplicadas manualmente no SQL Editor após o merge.
- `ALTER TYPE ... ADD VALUE` fica em migration isolada (não usar o valor novo na mesma transação).

---

## Ordem de branch

Trabalhar numa branch a partir de `origin/main` (já criada: `feat/ecommerce-anuncios-painel`). Não encadear em cima de outra branch não-mergeada.

---

### Task 1: Migration — novo papel `assessor_ecommerce`

**Files:**
- Create: `supabase/migrations/20260708000000_user_role_assessor_ecommerce.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/20260708000000_user_role_assessor_ecommerce.sql
-- Adiciona o papel do setor de e-commerce ao enum user_role.
-- ADD VALUE fica isolado: não pode ser usado na mesma transação em que é criado.
alter type public.user_role add value if not exists 'assessor_ecommerce';
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260708000000_user_role_assessor_ecommerce.sql
git commit -m "feat(ecommerce): migration do papel assessor_ecommerce"
```

---

### Task 2: Migration — tabela `anuncios_ecommerce`

**Files:**
- Create: `supabase/migrations/20260708000100_anuncios_ecommerce.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/20260708000100_anuncios_ecommerce.sql
-- Setor E-commerce: registro por lote/dia de anúncios (listagens de marketplace)
-- subidos por assessor para cada cliente.

create table if not exists public.anuncios_ecommerce (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  colaborador_id uuid references public.profiles(id) on delete set null,
  data date not null default current_date,
  quantidade integer not null check (quantidade > 0),
  marketplace text not null check (marketplace in
    ('mercado_livre','shopee','amazon','magalu','outro')),
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  arquivado_em timestamptz
);

create index if not exists anuncios_ecommerce_org_data_idx
  on public.anuncios_ecommerce(organization_id, data desc) where arquivado_em is null;
create index if not exists anuncios_ecommerce_client_idx
  on public.anuncios_ecommerce(client_id) where arquivado_em is null;
create index if not exists anuncios_ecommerce_colaborador_idx
  on public.anuncios_ecommerce(colaborador_id) where arquivado_em is null;

drop trigger if exists anuncios_ecommerce_set_updated_at on public.anuncios_ecommerce;
create trigger anuncios_ecommerce_set_updated_at
  before update on public.anuncios_ecommerce
  for each row execute function public.set_updated_at();

alter table public.anuncios_ecommerce enable row level security;
drop policy if exists anuncios_ecommerce_select on public.anuncios_ecommerce;
create policy anuncios_ecommerce_select on public.anuncios_ecommerce
  for select to authenticated using (true);
drop policy if exists anuncios_ecommerce_insert on public.anuncios_ecommerce;
create policy anuncios_ecommerce_insert on public.anuncios_ecommerce
  for insert to authenticated with check (true);
drop policy if exists anuncios_ecommerce_update on public.anuncios_ecommerce;
create policy anuncios_ecommerce_update on public.anuncios_ecommerce
  for update to authenticated using (true);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260708000100_anuncios_ecommerce.sql
git commit -m "feat(ecommerce): migration da tabela anuncios_ecommerce"
```

---

### Task 3: Papel no sistema de permissões

**Files:**
- Modify: `src/lib/auth/permissions.ts`
- Test: `tests/unit/permissions.test.ts` (adicionar caso)

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao fim de `tests/unit/permissions.test.ts` (dentro do describe existente ou num novo):

```ts
import { describe, it, expect } from "vitest";
import { ROLE_LABELS, roleLabel, canAccess } from "@/lib/auth/permissions";

describe("assessor_ecommerce role", () => {
  it("tem label visível", () => {
    expect(ROLE_LABELS.assessor_ecommerce).toBe("Assessor de e-commerce");
    expect(roleLabel("assessor_ecommerce")).toBe("Assessor de e-commerce");
  });
  it("não tem acesso a ações privilegiadas por padrão", () => {
    expect(canAccess("assessor_ecommerce", "manage:users")).toBe(false);
    expect(canAccess("assessor_ecommerce", "view:financial_consolidated")).toBe(false);
  });
  it("pode criar tarefas", () => {
    expect(canAccess("assessor_ecommerce", "create:tasks")).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- tests/unit/permissions.test.ts`
Expected: FAIL (`ROLE_LABELS.assessor_ecommerce` é `undefined`; `canAccess` retorna false para `create:tasks` porque o papel não está no `matrix`).

- [ ] **Step 3: Adicionar o papel ao tipo `Role`**

Em `src/lib/auth/permissions.ts`, alterar o tipo:

```ts
export type Role =
  | "adm" | "socio" | "comercial" | "coordenador" | "assessor"
  | "videomaker" | "designer" | "editor" | "audiovisual_chefe"
  | "assessor_ecommerce";
```

- [ ] **Step 4: Adicionar o label**

Em `ROLE_LABELS`, adicionar a entrada (após `audiovisual_chefe`):

```ts
  audiovisual_chefe: "Coordenador audiovisual",
  assessor_ecommerce: "Assessor de e-commerce",
```

- [ ] **Step 5: Adicionar o papel ao `matrix`**

Em `const matrix: Record<Role, Action[]>`, adicionar a entrada (após `audiovisual_chefe`):

```ts
  assessor_ecommerce: [
    "view:all_clients",
    "view:own_commission",
    "create:tasks", "create:calendar_event", "customize:notification_recipients",
  ],
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `npm test -- tests/unit/permissions.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth/permissions.ts tests/unit/permissions.test.ts
git commit -m "feat(ecommerce): registra papel assessor_ecommerce nas permissões"
```

---

### Task 4: Constantes de marketplace

**Files:**
- Create: `src/lib/ecommerce/marketplaces.ts`

- [ ] **Step 1: Criar o arquivo**

```ts
export const MARKETPLACES = [
  "mercado_livre",
  "shopee",
  "amazon",
  "magalu",
  "outro",
] as const;

export type Marketplace = (typeof MARKETPLACES)[number];

export const MARKETPLACE_LABELS: Record<Marketplace, string> = {
  mercado_livre: "Mercado Livre",
  shopee: "Shopee",
  amazon: "Amazon",
  magalu: "Magalu",
  outro: "Outro",
};

export function marketplaceLabel(m: string): string {
  return (MARKETPLACE_LABELS as Record<string, string>)[m] ?? m;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/ecommerce/marketplaces.ts
git commit -m "feat(ecommerce): constantes de marketplace"
```

---

### Task 5: Função pura de agregação (TDD)

**Files:**
- Create: `src/lib/ecommerce/aggregate.ts`
- Test: `tests/unit/ecommerce-aggregate.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { aggregateAnuncios, type AnuncioAggRow } from "@/lib/ecommerce/aggregate";

const rows: AnuncioAggRow[] = [
  { data: "2026-07-01", quantidade: 10, marketplace: "mercado_livre",
    colaborador_id: "a1", colaborador_nome: "Ana", client_id: "c1", client_nome: "Loja X" },
  { data: "2026-07-01", quantidade: 5, marketplace: "shopee",
    colaborador_id: "a1", colaborador_nome: "Ana", client_id: "c2", client_nome: "Loja Y" },
  { data: "2026-07-02", quantidade: 8, marketplace: "mercado_livre",
    colaborador_id: "a2", colaborador_nome: "Bia", client_id: "c1", client_nome: "Loja X" },
];

describe("aggregateAnuncios", () => {
  it("soma os KPIs", () => {
    const r = aggregateAnuncios(rows);
    expect(r.kpis.total).toBe(23);
    expect(r.kpis.clientes).toBe(2);
    expect(r.kpis.assessores).toBe(2);
    expect(r.kpis.dias).toBe(2);
  });

  it("ranking por assessor em ordem decrescente", () => {
    const r = aggregateAnuncios(rows);
    expect(r.porAssessor).toEqual([
      { id: "a1", nome: "Ana", total: 15 },
      { id: "a2", nome: "Bia", total: 8 },
    ]);
  });

  it("total por cliente em ordem decrescente", () => {
    const r = aggregateAnuncios(rows);
    expect(r.porCliente).toEqual([
      { id: "c1", nome: "Loja X", total: 18 },
      { id: "c2", nome: "Loja Y", total: 5 },
    ]);
  });

  it("quebra por marketplace", () => {
    const r = aggregateAnuncios(rows);
    expect(r.porMarketplace).toEqual([
      { marketplace: "mercado_livre", total: 18 },
      { marketplace: "shopee", total: 5 },
    ]);
  });

  it("evolução no tempo em ordem crescente de data", () => {
    const r = aggregateAnuncios(rows);
    expect(r.porTempo).toEqual([
      { data: "2026-07-01", total: 15 },
      { data: "2026-07-02", total: 8 },
    ]);
  });

  it("lida com lista vazia", () => {
    const r = aggregateAnuncios([]);
    expect(r.kpis).toEqual({ total: 0, clientes: 0, assessores: 0, dias: 0 });
    expect(r.porAssessor).toEqual([]);
    expect(r.porCliente).toEqual([]);
    expect(r.porMarketplace).toEqual([]);
    expect(r.porTempo).toEqual([]);
  });

  it("agrupa 'sem assessor' quando colaborador_id é null", () => {
    const r = aggregateAnuncios([
      { data: "2026-07-01", quantidade: 3, marketplace: "outro",
        colaborador_id: null, colaborador_nome: null, client_id: "c1", client_nome: "Loja X" },
    ]);
    expect(r.porAssessor).toEqual([{ id: "sem", nome: "Sem assessor", total: 3 }]);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- tests/unit/ecommerce-aggregate.test.ts`
Expected: FAIL (`aggregateAnuncios` não existe).

- [ ] **Step 3: Implementar a função**

```ts
export interface AnuncioAggRow {
  data: string; // YYYY-MM-DD
  quantidade: number;
  marketplace: string;
  colaborador_id: string | null;
  colaborador_nome: string | null;
  client_id: string;
  client_nome: string | null;
}

export interface EcommerceAggregate {
  kpis: { total: number; clientes: number; assessores: number; dias: number };
  porAssessor: { id: string; nome: string; total: number }[];
  porCliente: { id: string; nome: string; total: number }[];
  porMarketplace: { marketplace: string; total: number }[];
  porTempo: { data: string; total: number }[];
}

function somaDesc(
  map: Map<string, { nome: string; total: number }>,
): { id: string; nome: string; total: number }[] {
  return [...map.entries()]
    .map(([id, v]) => ({ id, nome: v.nome, total: v.total }))
    .sort((a, b) => b.total - a.total);
}

export function aggregateAnuncios(rows: AnuncioAggRow[]): EcommerceAggregate {
  const assessor = new Map<string, { nome: string; total: number }>();
  const cliente = new Map<string, { nome: string; total: number }>();
  const marketplace = new Map<string, number>();
  const tempo = new Map<string, number>();
  let total = 0;

  for (const r of rows) {
    const q = r.quantidade;
    total += q;

    const aId = r.colaborador_id ?? "sem";
    const aNome = r.colaborador_id ? (r.colaborador_nome ?? "—") : "Sem assessor";
    const a = assessor.get(aId);
    if (a) a.total += q;
    else assessor.set(aId, { nome: aNome, total: q });

    const c = cliente.get(r.client_id);
    if (c) c.total += q;
    else cliente.set(r.client_id, { nome: r.client_nome ?? "—", total: q });

    marketplace.set(r.marketplace, (marketplace.get(r.marketplace) ?? 0) + q);
    tempo.set(r.data, (tempo.get(r.data) ?? 0) + q);
  }

  return {
    kpis: {
      total,
      clientes: cliente.size,
      assessores: assessor.size,
      dias: tempo.size,
    },
    porAssessor: somaDesc(assessor),
    porCliente: somaDesc(cliente),
    porMarketplace: [...marketplace.entries()]
      .map(([marketplace, total]) => ({ marketplace, total }))
      .sort((a, b) => b.total - a.total),
    porTempo: [...tempo.entries()]
      .map(([data, total]) => ({ data, total }))
      .sort((a, b) => a.data.localeCompare(b.data)),
  };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- tests/unit/ecommerce-aggregate.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ecommerce/aggregate.ts tests/unit/ecommerce-aggregate.test.ts
git commit -m "feat(ecommerce): função pura de agregação com testes"
```

---

### Task 6: Schema de validação (Zod)

**Files:**
- Create: `src/lib/ecommerce/schema.ts`

- [ ] **Step 1: Criar o arquivo**

```ts
import { z } from "zod";
import { MARKETPLACES } from "./marketplaces";

const uuidLike = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  "ID inválido",
);

export const criarAnuncioSchema = z.object({
  client_id: uuidLike,
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  quantidade: z.coerce.number().int().min(1, "Quantidade deve ser ≥ 1").max(100000),
  marketplace: z.enum(MARKETPLACES),
  observacao: z.string().trim().max(2000).optional().nullable(),
});

export const updateAnuncioSchema = criarAnuncioSchema.extend({ id: uuidLike });
export const arquivarAnuncioSchema = z.object({ id: uuidLike });

export type CriarAnuncioInput = z.infer<typeof criarAnuncioSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/ecommerce/schema.ts
git commit -m "feat(ecommerce): schema de validação dos lançamentos"
```

---

### Task 7: Queries (server-only)

**Files:**
- Create: `src/lib/ecommerce/queries.ts`

Papéis com visão total (veem todos os lançamentos): `adm`, `socio`. Demais (`assessor_ecommerce`) veem só os próprios.

- [ ] **Step 1: Criar o arquivo**

```ts
// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { AnuncioAggRow } from "./aggregate";

export const CHEFIA_ROLES = ["adm", "socio"] as const;
export function veTudo(role: string): boolean {
  return (CHEFIA_ROLES as readonly string[]).includes(role);
}

export interface ClienteEcommerceOption {
  id: string;
  nome: string;
}

/** Clientes com pacote e-commerce da organização, não arquivados. */
export async function listClientesEcommerce(
  orgId: string,
): Promise<ClienteEcommerceOption[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data, error } = await sb
    .from("clients")
    .select("id, nome")
    .eq("organization_id", orgId)
    .eq("tipo_pacote", "ecommerce")
    .is("deleted_at", null)
    .order("nome");
  if (error) {
    console.error("[ecommerce] listClientesEcommerce", error.message);
    return [];
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    nome: r.nome as string,
  }));
}

export interface AnuncioRow extends AnuncioAggRow {
  id: string;
  observacao: string | null;
  created_at: string;
}

export interface ListAnunciosFilters {
  de?: string | null; // YYYY-MM-DD
  ate?: string | null; // YYYY-MM-DD
  assessorId?: string | null;
}

/**
 * Lista lançamentos aplicando escopo por papel:
 * - veTudo(role): todos da org (com filtro opcional por assessor)
 * - senão: apenas os do próprio usuário (actorId)
 */
export async function listAnuncios(
  orgId: string,
  role: string,
  actorId: string,
  filters: ListAnunciosFilters = {},
): Promise<AnuncioRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  let q = sb
    .from("anuncios_ecommerce")
    .select(
      "id, data, quantidade, marketplace, observacao, colaborador_id, client_id, created_at, " +
        "colaborador:profiles!anuncios_ecommerce_colaborador_id_fkey(nome), " +
        "client:clients!anuncios_ecommerce_client_id_fkey(nome)",
    )
    .eq("organization_id", orgId)
    .is("arquivado_em", null);

  if (!veTudo(role)) {
    q = q.eq("colaborador_id", actorId);
  } else if (filters.assessorId) {
    q = q.eq("colaborador_id", filters.assessorId);
  }
  if (filters.de) q = q.gte("data", filters.de);
  if (filters.ate) q = q.lte("data", filters.ate);

  q = q.order("data", { ascending: false }).order("created_at", { ascending: false });

  const { data, error } = await q;
  if (error) {
    console.error("[ecommerce] listAnuncios", error.message);
    return [];
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    data: r.data as string,
    quantidade: Number(r.quantidade ?? 0),
    marketplace: r.marketplace as string,
    observacao: (r.observacao as string | null) ?? null,
    colaborador_id: (r.colaborador_id as string | null) ?? null,
    colaborador_nome:
      ((r.colaborador as { nome?: string } | null) ?? null)?.nome ?? null,
    client_id: r.client_id as string,
    client_nome: ((r.client as { nome?: string } | null) ?? null)?.nome ?? null,
    created_at: r.created_at as string,
  }));
}

export interface AssessorOption {
  id: string;
  nome: string;
}

/** Assessores de e-commerce ativos da org (para o filtro do painel). */
export async function listAssessoresEcommerce(): Promise<AssessorOption[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data, error } = await sb
    .from("profiles")
    .select("id, nome")
    .eq("role", "assessor_ecommerce")
    .eq("ativo", true)
    .order("nome");
  if (error) {
    console.error("[ecommerce] listAssessoresEcommerce", error.message);
    return [];
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    nome: r.nome as string,
  }));
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npm run typecheck`
Expected: sem erros novos nesse arquivo.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ecommerce/queries.ts
git commit -m "feat(ecommerce): queries de clientes, lançamentos e assessores"
```

---

### Task 8: Server actions (criar / editar / arquivar)

**Files:**
- Create: `src/lib/ecommerce/actions.ts`

- [ ] **Step 1: Criar o arquivo**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { veTudo } from "./queries";
import {
  criarAnuncioSchema,
  updateAnuncioSchema,
  arquivarAnuncioSchema,
} from "./schema";

interface Ok { success: true }
interface Err { error: string }
type Result = Ok | Err;

const ROLES_LANCAM = ["adm", "socio", "assessor_ecommerce"] as const;
function podeLancar(role: string) {
  return (ROLES_LANCAM as readonly string[]).includes(role);
}
function fd(f: FormData, k: string): string | null {
  const v = f.get(k);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export async function criarAnuncioAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  if (!podeLancar(actor.role)) return { error: "Sem permissão" };
  const parsed = criarAnuncioSchema.safeParse({
    client_id: fd(formData, "client_id"),
    data: fd(formData, "data"),
    quantidade: fd(formData, "quantidade"),
    marketplace: fd(formData, "marketplace"),
    observacao: fd(formData, "observacao"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const orgId = await getOrganizationId(actor.id);
  if (!orgId) return { error: "Organização não encontrada" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  // valida que o cliente é e-commerce e pertence à org
  const { data: cli } = await sb
    .from("clients")
    .select("id")
    .eq("id", parsed.data.client_id)
    .eq("organization_id", orgId)
    .eq("tipo_pacote", "ecommerce")
    .is("deleted_at", null)
    .maybeSingle();
  if (!cli) return { error: "Cliente e-commerce não encontrado" };

  const { error } = await sb.from("anuncios_ecommerce").insert({
    organization_id: orgId,
    client_id: parsed.data.client_id,
    colaborador_id: actor.id,
    data: parsed.data.data,
    quantidade: parsed.data.quantidade,
    marketplace: parsed.data.marketplace,
    observacao: parsed.data.observacao,
  });
  if (error) return { error: error.message };
  revalidatePath("/ecommerce");
  return { success: true };
}

export async function updateAnuncioAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  if (!podeLancar(actor.role)) return { error: "Sem permissão" };
  const parsed = updateAnuncioSchema.safeParse({
    id: fd(formData, "id"),
    client_id: fd(formData, "client_id"),
    data: fd(formData, "data"),
    quantidade: fd(formData, "quantidade"),
    marketplace: fd(formData, "marketplace"),
    observacao: fd(formData, "observacao"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const orgId = await getOrganizationId(actor.id);
  if (!orgId) return { error: "Organização não encontrada" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  // assessor só edita o próprio; chefia edita qualquer um da org
  let q = sb
    .from("anuncios_ecommerce")
    .update({
      client_id: parsed.data.client_id,
      data: parsed.data.data,
      quantidade: parsed.data.quantidade,
      marketplace: parsed.data.marketplace,
      observacao: parsed.data.observacao,
    })
    .eq("id", parsed.data.id)
    .eq("organization_id", orgId);
  if (!veTudo(actor.role)) q = q.eq("colaborador_id", actor.id);
  // RLS permissiva → .update() é silencioso; usamos .select() pra checar rows
  const { data, error } = await q.select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Nada para atualizar" };
  revalidatePath("/ecommerce");
  return { success: true };
}

export async function arquivarAnuncioAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  if (!podeLancar(actor.role)) return { error: "Sem permissão" };
  const parsed = arquivarAnuncioSchema.safeParse({ id: fd(formData, "id") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const orgId = await getOrganizationId(actor.id);
  if (!orgId) return { error: "Organização não encontrada" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  let q = sb
    .from("anuncios_ecommerce")
    .update({ arquivado_em: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("organization_id", orgId);
  if (!veTudo(actor.role)) q = q.eq("colaborador_id", actor.id);
  const { data, error } = await q.select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Nada para arquivar" };
  revalidatePath("/ecommerce");
  return { success: true };
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npm run typecheck`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ecommerce/actions.ts
git commit -m "feat(ecommerce): server actions de lançamento"
```

---

### Task 9: UI — botão/modal "Novo lançamento"

**Files:**
- Create: `src/components/ecommerce/NovoAnuncioButton.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { criarAnuncioAction } from "@/lib/ecommerce/actions";
import { MARKETPLACES, MARKETPLACE_LABELS } from "@/lib/ecommerce/marketplaces";

interface Props {
  clientes: { id: string; nome: string }[];
}

export function NovoAnuncioButton({ clientes }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    setError(null);
    start(async () => {
      const r = await criarAnuncioAction(formData);
      if ("error" in r) { setError(r.error); return; }
      setOpen(false);
      router.refresh();
    });
  }

  const semClientes = clientes.length === 0;

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} disabled={semClientes}>
        <Plus className="h-4 w-4" /> Novo lançamento
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <form
            action={submit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-3 rounded-xl border bg-card p-5"
          >
            <h2 className="font-semibold">Novo lançamento de anúncios</h2>

            <div className="space-y-1.5">
              <Label htmlFor="client_id">Cliente (e-commerce)</Label>
              <select
                id="client_id"
                name="client_id"
                required
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione…</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="quantidade">Quantidade</Label>
                <Input
                  id="quantidade"
                  name="quantidade"
                  type="number"
                  min={1}
                  required
                  defaultValue={1}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="data">Data</Label>
                <Input
                  id="data"
                  name="data"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="marketplace">Marketplace</Label>
              <select
                id="marketplace"
                name="marketplace"
                required
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                {MARKETPLACES.map((m) => (
                  <option key={m} value={m}>{MARKETPLACE_LABELS[m]}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="observacao">Observação (opcional)</Label>
              <Textarea id="observacao" name="observacao" rows={2} maxLength={2000} />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npm run typecheck`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add src/components/ecommerce/NovoAnuncioButton.tsx
git commit -m "feat(ecommerce): modal de novo lançamento"
```

---

### Task 10: UI — lista de lançamentos + arquivar

**Files:**
- Create: `src/components/ecommerce/AnunciosList.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { arquivarAnuncioAction } from "@/lib/ecommerce/actions";
import { marketplaceLabel } from "@/lib/ecommerce/marketplaces";
import type { AnuncioRow } from "@/lib/ecommerce/queries";

interface Props {
  anuncios: AnuncioRow[];
  mostrarAssessor: boolean;
  podeArquivar: boolean;
}

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function AnunciosList({ anuncios, mostrarAssessor, podeArquivar }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function arquivar(id: string) {
    if (!confirm("Arquivar este lançamento?")) return;
    start(async () => {
      const fd = new FormData();
      fd.set("id", id);
      const r = await arquivarAnuncioAction(fd);
      if ("error" in r) { alert(r.error); return; }
      router.refresh();
    });
  }

  if (anuncios.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum lançamento no período.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {anuncios.map((a) => (
        <div
          key={a.id}
          className="flex flex-wrap items-start justify-between gap-2 rounded-md border bg-card p-3"
        >
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-semibold truncate">
              {a.client_nome ?? "—"}
              <span className="ml-2 rounded-full border bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums">
                {a.quantidade} {a.quantidade === 1 ? "anúncio" : "anúncios"}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {formatarData(a.data)} &middot; {marketplaceLabel(a.marketplace)}
              {mostrarAssessor && a.colaborador_nome ? (
                <span> &middot; {a.colaborador_nome}</span>
              ) : null}
            </p>
            {a.observacao ? (
              <p className="text-xs text-muted-foreground">{a.observacao}</p>
            ) : null}
          </div>
          {podeArquivar && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={pending}
              onClick={() => arquivar(a.id)}
              aria-label="Arquivar"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
```

> Nota: edição inline fica fora do MVP (arquivar + relançar cobre o caso). A action `updateAnuncioAction` já existe para uso futuro.

- [ ] **Step 2: Verificar typecheck**

Run: `npm run typecheck`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add src/components/ecommerce/AnunciosList.tsx
git commit -m "feat(ecommerce): lista de lançamentos com arquivar"
```

---

### Task 11: UI — painel consolidado (chefia)

**Files:**
- Create: `src/components/ecommerce/PainelEcommerce.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
import { marketplaceLabel } from "@/lib/ecommerce/marketplaces";
import type { EcommerceAggregate } from "@/lib/ecommerce/aggregate";

interface Props {
  agg: EcommerceAggregate;
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function BarList({
  title,
  items,
}: {
  title: string;
  items: { label: string; total: number }[];
}) {
  const max = items.reduce((m, i) => Math.max(m, i.total), 0) || 1;
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem dados no período.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.label} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="truncate">{i.label}</span>
                <span className="tabular-nums font-medium">{i.total}</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${(i.total / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PainelEcommerce({ agg }: Props) {
  const mediaDia = agg.kpis.dias > 0 ? Math.round(agg.kpis.total / agg.kpis.dias) : 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Total de anúncios" value={agg.kpis.total} />
        <Kpi label="Clientes atendidos" value={agg.kpis.clientes} />
        <Kpi label="Assessores ativos" value={agg.kpis.assessores} />
        <Kpi label="Média por dia" value={mediaDia} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <BarList
          title="Ranking por assessor"
          items={agg.porAssessor.map((a) => ({ label: a.nome, total: a.total }))}
        />
        <BarList
          title="Total por cliente"
          items={agg.porCliente.map((c) => ({ label: c.nome, total: c.total }))}
        />
        <BarList
          title="Por marketplace"
          items={agg.porMarketplace.map((m) => ({
            label: marketplaceLabel(m.marketplace),
            total: m.total,
          }))}
        />
        <BarList
          title="Evolução no tempo"
          items={agg.porTempo.map((t) => {
            const [ano, mes, dia] = t.data.split("-");
            return { label: `${dia}/${mes}/${ano}`, total: t.total };
          })}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npm run typecheck`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add src/components/ecommerce/PainelEcommerce.tsx
git commit -m "feat(ecommerce): componente do painel consolidado"
```

---

### Task 12: UI — filtro de período (client, navega por searchParams)

**Files:**
- Create: `src/components/ecommerce/FiltroPeriodo.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  de: string;
  ate: string;
  tab: string;
}

export function FiltroPeriodo({ de, ate, tab }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(key: "de" | "ate", value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.set("tab", tab);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="de" className="text-xs">De</Label>
        <Input
          id="de"
          type="date"
          defaultValue={de}
          onChange={(e) => update("de", e.target.value)}
          className="h-9"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="ate" className="text-xs">Até</Label>
        <Input
          id="ate"
          type="date"
          defaultValue={ate}
          onChange={(e) => update("ate", e.target.value)}
          className="h-9"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npm run typecheck`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add src/components/ecommerce/FiltroPeriodo.tsx
git commit -m "feat(ecommerce): filtro de período por searchParams"
```

---

### Task 13: Página `/ecommerce` com abas

**Files:**
- Create: `src/app/(authed)/ecommerce/page.tsx`

Abas via searchParam `tab` (`lancar` | `painel`). Painel só para chefia. Período default = mês corrente.

- [ ] **Step 1: Criar a página**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import {
  listAnuncios,
  listClientesEcommerce,
  veTudo,
} from "@/lib/ecommerce/queries";
import { aggregateAnuncios } from "@/lib/ecommerce/aggregate";
import { NovoAnuncioButton } from "@/components/ecommerce/NovoAnuncioButton";
import { AnunciosList } from "@/components/ecommerce/AnunciosList";
import { PainelEcommerce } from "@/components/ecommerce/PainelEcommerce";
import { FiltroPeriodo } from "@/components/ecommerce/FiltroPeriodo";

const ALLOWED = ["adm", "socio", "assessor_ecommerce"];

function inicioDoMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function EcommercePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; de?: string; ate?: string }>;
}) {
  const user = await requireAuth();
  if (!ALLOWED.includes(user.role)) notFound();
  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();

  const sp = await searchParams;
  const chefia = veTudo(user.role);
  const tab = sp.tab === "painel" && chefia ? "painel" : "lancar";
  const de = sp.de || inicioDoMes();
  const ate = sp.ate || hoje();

  const [clientes, anuncios] = await Promise.all([
    listClientesEcommerce(orgId),
    listAnuncios(orgId, user.role, user.id, { de, ate }),
  ]);
  const agg = aggregateAnuncios(anuncios);

  const tabHref = (t: string) => {
    const p = new URLSearchParams();
    p.set("tab", t);
    p.set("de", de);
    p.set("ate", ate);
    return `/ecommerce?${p.toString()}`;
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">E-commerce</h1>
          <p className="text-sm text-muted-foreground">
            Registre os anúncios subidos por cliente e acompanhe a produtividade.
          </p>
        </div>
        <NovoAnuncioButton clientes={clientes} />
      </header>

      {clientes.length === 0 && (
        <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          Nenhum cliente com pacote e-commerce ainda. Defina o pacote do cliente
          como &quot;E-commerce&quot; no cadastro para ele aparecer aqui.
        </p>
      )}

      {chefia && (
        <nav className="flex gap-2 border-b">
          <Link
            href={tabHref("lancar")}
            className={`px-3 py-2 text-sm font-medium ${
              tab === "lancar"
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground"
            }`}
          >
            Lançamentos
          </Link>
          <Link
            href={tabHref("painel")}
            className={`px-3 py-2 text-sm font-medium ${
              tab === "painel"
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground"
            }`}
          >
            Painel
          </Link>
        </nav>
      )}

      <FiltroPeriodo de={de} ate={ate} tab={tab} />

      {tab === "painel" && chefia ? (
        <PainelEcommerce agg={agg} />
      ) : (
        <AnunciosList
          anuncios={anuncios}
          mostrarAssessor={chefia}
          podeArquivar={true}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(authed)/ecommerce/page.tsx"
git commit -m "feat(ecommerce): página /ecommerce com abas e filtro"
```

---

### Task 14: Item no menu lateral

**Files:**
- Modify: `src/components/layout/nav-config.ts`

- [ ] **Step 1: Importar o ícone**

No import de `lucide-react` (topo do arquivo), adicionar `ShoppingCart` à lista:

```ts
  IdCard, Rocket, BookOpen, Inbox, Activity, Layers, Sparkles, Zap, MapPin, Target, ShoppingCart,
```

- [ ] **Step 2: Adicionar o link no grupo "operacao"**

Dentro do grupo `{ id: "operacao", ... items: [ ... ] }`, adicionar (logo após o link `/trafego`):

```ts
      { type: "link", href: "/ecommerce", icon: ShoppingCart, label: "E-commerce", roles: ["adm", "socio", "assessor_ecommerce"], badgeKey: null },
```

- [ ] **Step 3: Verificar typecheck**

Run: `npm run typecheck`
Expected: sem erros (o `Role` já inclui `assessor_ecommerce` da Task 3).

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/nav-config.ts
git commit -m "feat(ecommerce): item E-commerce no menu Operação"
```

---

### Task 15: Verificação final, build e PR

- [ ] **Step 1: Rodar toda a bateria**

Run: `npm run typecheck && npm run lint && npm test`
Expected: tudo verde. Se algo falhar, corrigir antes de seguir.

- [ ] **Step 2: Build local (garante que a rota compila)**

Run: `npm run build`
Expected: build conclui sem erro na rota `/ecommerce`.

- [ ] **Step 3: Push e abrir PR**

```bash
git push -u origin feat/ecommerce-anuncios-painel
gh pr create --title "feat: módulo E-commerce (painel de anúncios por assessor)" \
  --body "$(cat <<'EOF'
## O que
Novo módulo /ecommerce para o setor de assessoria de e-commerce: o assessor
registra quantos anúncios (listagens de marketplace) subiu por cliente e a
chefia acompanha um painel consolidado.

## Detalhes
- Novo papel `assessor_ecommerce`.
- Tabela `anuncios_ecommerce` (lote/dia: cliente, quantidade, marketplace, obs).
- Cliente e-commerce = `tipo_pacote = 'ecommerce'` (já existente, sem migration de cliente).
- Assessor vê/gerencia só os próprios lançamentos; adm/sócio veem tudo + painel.
- Painel: KPIs, ranking por assessor, total por cliente, evolução no tempo, por marketplace.

## Migrations manuais (aplicar no SQL Editor do Supabase após o merge)
1. `20260708000000_user_role_assessor_ecommerce.sql`
2. `20260708000100_anuncios_ecommerce.sql`

Spec: docs/superpowers/specs/2026-07-08-ecommerce-anuncios-painel-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Aguardar CI verde e mergear**

Após `ci.yml` verde: `gh pr merge --squash --delete-branch`.

- [ ] **Step 5: Aplicar as migrations manualmente**

No SQL Editor do Supabase (produção), rodar na ordem:
1. `20260708000000_user_role_assessor_ecommerce.sql`
2. `20260708000100_anuncios_ecommerce.sql`

Depois disso, atribuir o papel "Assessor de e-commerce" aos colaboradores do setor
em /colaboradores.

---

## Self-Review (feito pelo autor do plano)

**Cobertura do spec:**
- Papel novo → Tasks 1, 3. ✓
- Cliente e-commerce via `tipo_pacote` → Tasks 7, 8 (filtro `tipo_pacote='ecommerce'`). ✓
- Tabela `anuncios_ecommerce` → Task 2. ✓
- Lançamento por lote/dia (cliente, quantidade, marketplace, observação, data) → Tasks 6, 8, 9. ✓
- Assessor vê só o próprio / chefia vê tudo → `veTudo()` + `listAnuncios` (Task 7), actions (Task 8), página (Task 13). ✓
- Painel: KPIs, ranking assessor, total cliente, evolução, marketplace → Tasks 5, 11, 13. ✓
- Filtro de período → Tasks 12, 13. ✓
- Item no menu Operação → Task 14. ✓
- Testes (agregação pura TDD + permissões) → Tasks 3, 5. ✓
- Migrations manuais → Task 15. ✓

**Consistência de tipos:** `AnuncioAggRow` (Task 5) é estendido por `AnuncioRow` (Task 7); `EcommerceAggregate` (Task 5) consumido por `PainelEcommerce` (Task 11); `veTudo`/`CHEFIA_ROLES` definidos em queries (Task 7) e reusados em actions (Task 8) e página (Task 13). `ClienteEcommerceOption` (Task 7) casa com props de `NovoAnuncioButton` (Task 9). OK.

**Placeholders:** nenhum — todo passo tem código/comando completo.
