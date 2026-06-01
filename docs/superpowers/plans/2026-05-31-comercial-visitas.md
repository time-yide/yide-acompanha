# Comercial Ligação/Rua + módulo Visitas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Dividir o menu "Comercial" em "Comercial Ligação" e "Comercial Rua", e criar o módulo Visitas (registrar visitas de rua + os leads conseguidos nelas, integrados ao Gerador de Leads).

**Architecture:** Edição do nav-config (2 grupos no lugar de 1). Novo módulo `visitas` (rota + lib + componentes) seguindo o padrão do `gerador-leads`. Leads da visita são linhas em `leads_gerados` (`fonte='visita'`, `visita_id`), reusando `LeadsTable`/`LeadActions`. Uma migration cria `visitas` e estende `leads_gerados`.

**Tech Stack:** Next.js (customizado — conferir `node_modules/next/dist/docs/` antes de mexer em cache/route APIs), TypeScript, Zod, Supabase, Vitest. Migrations manuais pós-merge.

---

## Task 1: Migration (visitas + leads_gerados.visita_id)

**Files:** Create `supabase/migrations/20260620000000_visitas.sql`

- [ ] **Step 1: Criar a migration**

```sql
-- supabase/migrations/20260620000000_visitas.sql
-- Comercial Rua: visitas de rua + vínculo dos leads conseguidos nelas.

create table if not exists public.visitas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  colaborador_id uuid references public.profiles(id) on delete set null,
  data date not null,
  titulo text not null,
  bairro text,
  cidade text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  arquivado_em timestamptz
);

create index if not exists visitas_org_data_idx
  on public.visitas(organization_id, data desc) where arquivado_em is null;
create index if not exists visitas_colaborador_idx
  on public.visitas(colaborador_id) where arquivado_em is null;

drop trigger if exists visitas_set_updated_at on public.visitas;
create trigger visitas_set_updated_at
  before update on public.visitas
  for each row execute function public.set_updated_at();

alter table public.visitas enable row level security;
drop policy if exists visitas_select on public.visitas;
create policy visitas_select on public.visitas for select to authenticated using (true);
drop policy if exists visitas_insert on public.visitas;
create policy visitas_insert on public.visitas for insert to authenticated with check (true);
drop policy if exists visitas_update on public.visitas;
create policy visitas_update on public.visitas for update to authenticated using (true);

-- Vínculo dos leads de rua + nova origem 'visita'
alter table public.leads_gerados
  add column if not exists visita_id uuid references public.visitas(id) on delete set null;
create index if not exists leads_gerados_visita_idx
  on public.leads_gerados(visita_id) where arquivado_em is null;

alter table public.leads_gerados drop constraint if exists leads_gerados_fonte_check;
alter table public.leads_gerados
  add constraint leads_gerados_fonte_check
  check (fonte in ('outscraper','apify','manual','visita'));
```

- [ ] **Step 2: Commit**
```bash
git add supabase/migrations/20260620000000_visitas.sql
git commit -m "feat(visitas): migration tabela visitas + leads_gerados.visita_id

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Menu — Comercial Ligação / Comercial Rua

**Files:** Modify `src/components/layout/nav-config.ts`

- [ ] **Step 1: Substituir o grupo "comercial"**

Em `src/components/layout/nav-config.ts`, localizar o bloco `{ type: "group", id: "comercial", label: "Comercial", items: [...] }` e substituí-lo por DOIS grupos (mantendo os mesmos `roles` por item). `MapPin` já está disponível no import do lucide (senão, adicionar ao import):

```typescript
  {
    type: "group",
    id: "comercial-ligacao",
    label: "Comercial Ligação",
    items: [
      { type: "link", href: "/ligacoes", icon: Phone, label: "Ligações", roles: ["adm", "socio", "comercial", "coordenador", "assessor"], badgeKey: null },
      { type: "link", href: "/onboarding", icon: KanbanSquare, label: "Onboarding", roles: ["adm", "socio", "comercial", "assessor", "coordenador", "audiovisual_chefe"], badgeKey: null },
      { type: "link", href: "/gerador-leads", icon: Radar, label: "Gerador de Leads", roles: ["adm", "socio", "comercial", "coordenador", "assessor"], badgeKey: null },
      { type: "link", href: "/conversas", icon: MessageCircle, label: "Conversas", roles: ["adm", "socio", "comercial", "coordenador", "assessor"], badgeKey: null },
    ],
  },
  {
    type: "group",
    id: "comercial-rua",
    label: "Comercial Rua",
    items: [
      { type: "link", href: "/visitas", icon: MapPin, label: "Visitas", roles: ["adm", "socio", "comercial", "coordenador", "assessor"], badgeKey: null },
    ],
  },
```

Confirmar que `MapPin` está no import de `lucide-react` no topo do arquivo; se não estiver, adicionar `MapPin`.

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit 2>&1 | grep -iE "nav-config" || echo "clean"` e `npx next lint 2>&1 | grep -iE "nav-config" || echo "lint clean"`

- [ ] **Step 3: Commit**
```bash
git add src/components/layout/nav-config.ts
git commit -m "feat(menu): divide Comercial em Ligação e Rua

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Integrar visita_id no Gerador de Leads (queries)

**Files:** Modify `src/lib/gerador-leads/queries.ts`

- [ ] **Step 1: Adicionar `visita_id` à interface `LeadGeradoRow`**

Em `src/lib/gerador-leads/queries.ts`, na interface `LeadGeradoRow`, adicionar (perto de `fonte`):
```typescript
  visita_id?: string | null;
```

- [ ] **Step 2: Adicionar `visita_id` ao SELECT (nos DOIS selects)**

Há duas strings de `.select(...)` idênticas (listagem e detalhe). Em AMBAS, adicionar `visita_id` logo após `fonte`:
```
..., responsavel_id, fonte, visita_id, created_at, updated_at, responsavel:profiles!leads_gerados_responsavel_id_fkey(nome)
```

- [ ] **Step 3: Adicionar ao mapeamento (nos DOIS lugares)**

Onde o row é mapeado pra `LeadGeradoRow` (há `fonte: row.fonte as string,` em ~2 lugares), adicionar logo após:
```typescript
    visita_id: (row.visita_id as string | null) ?? null,
```

- [ ] **Step 4: Adicionar filtro `visitaId`**

Na interface `ListLeadsFilter`, adicionar:
```typescript
  visitaId?: string;
```
E na `listLeadsGerados`, após os outros filtros (ex.: depois de `if (filter.comSite)`), adicionar:
```typescript
  if (filter.visitaId) q = q.eq("visita_id", filter.visitaId);
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -iE "gerador-leads/queries" || echo "clean"`
Expected: clean. (Obs: o SELECT só funciona em prod após a migration da Task 1 — aplicar logo após o merge.)

- [ ] **Step 6: Commit**
```bash
git add src/lib/gerador-leads/queries.ts
git commit -m "feat(gerador-leads): expõe visita_id + filtro visitaId

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Lib do módulo Visitas (schema + queries + actions) com TDD

**Files:**
- Create `src/lib/visitas/schema.ts`, `src/lib/visitas/queries.ts`, `src/lib/visitas/actions.ts`
- Test: `tests/unit/visitas-schema.test.ts`

- [ ] **Step 1: Teste que falha**

Create `tests/unit/visitas-schema.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { criarVisitaSchema, adicionarLeadVisitaSchema } from "@/lib/visitas/schema";

const UUID = "11111111-1111-1111-1111-111111111111";

describe("criarVisitaSchema", () => {
  it("aceita data + titulo", () => {
    expect(criarVisitaSchema.safeParse({ data: "2026-06-01", titulo: "Centro manhã" }).success).toBe(true);
  });
  it("rejeita sem titulo", () => {
    expect(criarVisitaSchema.safeParse({ data: "2026-06-01" }).success).toBe(false);
  });
});

describe("adicionarLeadVisitaSchema", () => {
  it("aceita empresa + visita_id", () => {
    expect(adicionarLeadVisitaSchema.safeParse({ visita_id: UUID, empresa: "Padaria X", telefone: "1133334444" }).success).toBe(true);
  });
  it("rejeita sem empresa", () => {
    expect(adicionarLeadVisitaSchema.safeParse({ visita_id: UUID }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e confirmar FAIL**

Run: `npx vitest run tests/unit/visitas-schema.test.ts` → FAIL.

- [ ] **Step 3: `src/lib/visitas/schema.ts`**
```typescript
import { z } from "zod";

const uuidLike = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  "ID inválido",
);

export const criarVisitaSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  titulo: z.string().trim().min(2).max(160),
  bairro: z.string().trim().max(120).optional().nullable(),
  cidade: z.string().trim().max(120).optional().nullable(),
  observacoes: z.string().trim().max(2000).optional().nullable(),
});

export const updateVisitaSchema = criarVisitaSchema.extend({ id: uuidLike });
export const arquivarVisitaSchema = z.object({ id: uuidLike });

export const adicionarLeadVisitaSchema = z.object({
  visita_id: uuidLike,
  empresa: z.string().trim().min(2).max(200),
  telefone: z.string().trim().max(40).optional().nullable(),
  whatsapp: z.string().trim().max(40).optional().nullable(),
  contato: z.string().trim().max(200).optional().nullable(),
  observacoes: z.string().trim().max(2000).optional().nullable(),
});

export type CriarVisitaInput = z.infer<typeof criarVisitaSchema>;
export type AdicionarLeadVisitaInput = z.infer<typeof adicionarLeadVisitaSchema>;
```

- [ ] **Step 4: Rodar e confirmar PASS**

Run: `npx vitest run tests/unit/visitas-schema.test.ts` → PASS (4 testes).

- [ ] **Step 5: `src/lib/visitas/queries.ts`**

Espelha o padrão de `gerador-leads/queries.ts` (service-role, scope por org). `getOrganizationId` já existe em `@/lib/gerador-leads/queries` — reusar.
```typescript
// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface VisitaRow {
  id: string;
  data: string;
  titulo: string;
  bairro: string | null;
  cidade: string | null;
  observacoes: string | null;
  colaborador_id: string | null;
  colaborador_nome: string | null;
  total_leads: number;
  created_at: string;
}

export async function listVisitas(organizationId: string): Promise<VisitaRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data, error } = await sb
    .from("visitas")
    .select("id, data, titulo, bairro, cidade, observacoes, colaborador_id, created_at, colaborador:profiles!visitas_colaborador_id_fkey(nome), leads:leads_gerados(count)")
    .eq("organization_id", organizationId)
    .is("arquivado_em", null)
    .order("data", { ascending: false });
  if (error) { console.error("[visitas] list", error.message); return []; }
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    data: row.data as string,
    titulo: row.titulo as string,
    bairro: (row.bairro as string | null) ?? null,
    cidade: (row.cidade as string | null) ?? null,
    observacoes: (row.observacoes as string | null) ?? null,
    colaborador_id: (row.colaborador_id as string | null) ?? null,
    colaborador_nome: ((row.colaborador as { nome?: string } | null) ?? null)?.nome ?? null,
    total_leads: Array.isArray(row.leads) ? Number((row.leads[0] as { count?: number })?.count ?? 0) : 0,
    created_at: row.created_at as string,
  }));
}

export async function getVisita(organizationId: string, id: string): Promise<VisitaRow | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data } = await sb
    .from("visitas")
    .select("id, data, titulo, bairro, cidade, observacoes, colaborador_id, created_at, colaborador:profiles!visitas_colaborador_id_fkey(nome)")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("arquivado_em", null)
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    data: row.data as string,
    titulo: row.titulo as string,
    bairro: (row.bairro as string | null) ?? null,
    cidade: (row.cidade as string | null) ?? null,
    observacoes: (row.observacoes as string | null) ?? null,
    colaborador_id: (row.colaborador_id as string | null) ?? null,
    colaborador_nome: ((row.colaborador as { nome?: string } | null) ?? null)?.nome ?? null,
    total_leads: 0,
    created_at: row.created_at as string,
  };
}
```
> Se o relacionamento aninhado `leads:leads_gerados(count)` der erro de schema (nome do FK), trocar por uma contagem separada (query `count` em `leads_gerados` por `visita_id`). O implementador deve validar o nome do relacionamento.

- [ ] **Step 6: `src/lib/visitas/actions.ts`**
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import {
  criarVisitaSchema, updateVisitaSchema, arquivarVisitaSchema, adicionarLeadVisitaSchema,
} from "./schema";

interface Ok { success: true }
interface Err { error: string }
type Result = Ok | Err;

const ROLES = ["adm", "socio", "comercial", "coordenador", "assessor"] as const;
function canManage(role: string) { return (ROLES as readonly string[]).includes(role); }
function fd(f: FormData, k: string): string | null {
  const v = f.get(k); if (typeof v !== "string") return null; const t = v.trim(); return t === "" ? null : t;
}

export async function criarVisitaAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };
  const parsed = criarVisitaSchema.safeParse({
    data: fd(formData, "data"), titulo: fd(formData, "titulo"),
    bairro: fd(formData, "bairro"), cidade: fd(formData, "cidade"), observacoes: fd(formData, "observacoes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const orgId = await getOrganizationId(actor.id);
  if (!orgId) return { error: "Organização não encontrada" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { error } = await sb.from("visitas").insert({
    organization_id: orgId, colaborador_id: actor.id,
    data: parsed.data.data, titulo: parsed.data.titulo,
    bairro: parsed.data.bairro, cidade: parsed.data.cidade, observacoes: parsed.data.observacoes,
  });
  if (error) return { error: error.message };
  revalidatePath("/visitas");
  return { success: true };
}

export async function updateVisitaAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };
  const parsed = updateVisitaSchema.safeParse({
    id: fd(formData, "id"), data: fd(formData, "data"), titulo: fd(formData, "titulo"),
    bairro: fd(formData, "bairro"), cidade: fd(formData, "cidade"), observacoes: fd(formData, "observacoes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { error } = await sb.from("visitas").update({
    data: parsed.data.data, titulo: parsed.data.titulo,
    bairro: parsed.data.bairro, cidade: parsed.data.cidade, observacoes: parsed.data.observacoes,
  }).eq("id", parsed.data.id);
  if (error) return { error: error.message };
  revalidatePath("/visitas"); revalidatePath(`/visitas/${parsed.data.id}`);
  return { success: true };
}

export async function arquivarVisitaAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };
  const parsed = arquivarVisitaSchema.safeParse({ id: fd(formData, "id") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { error } = await sb.from("visitas").update({ arquivado_em: new Date().toISOString() }).eq("id", parsed.data.id);
  if (error) return { error: error.message };
  revalidatePath("/visitas");
  return { success: true };
}

export async function adicionarLeadVisitaAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };
  const parsed = adicionarLeadVisitaSchema.safeParse({
    visita_id: fd(formData, "visita_id"), empresa: fd(formData, "empresa"),
    telefone: fd(formData, "telefone"), whatsapp: fd(formData, "whatsapp"),
    contato: fd(formData, "contato"), observacoes: fd(formData, "observacoes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const orgId = await getOrganizationId(actor.id);
  if (!orgId) return { error: "Organização não encontrada" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  // valida que a visita é da org
  const { data: visita } = await sb.from("visitas").select("id").eq("id", parsed.data.visita_id).eq("organization_id", orgId).is("arquivado_em", null).maybeSingle();
  if (!visita) return { error: "Visita não encontrada" };
  const { error } = await sb.from("leads_gerados").insert({
    organization_id: orgId,
    empresa: parsed.data.empresa,
    telefone: parsed.data.telefone,
    whatsapp: parsed.data.whatsapp,
    decisor_nome: parsed.data.contato,
    observacoes: parsed.data.observacoes,
    status: "novo",
    fonte: "visita",
    visita_id: parsed.data.visita_id,
    responsavel_id: actor.id,
  });
  if (error) return { error: error.message };
  revalidatePath(`/visitas/${parsed.data.visita_id}`);
  return { success: true };
}
```

- [ ] **Step 7: Type-check + lint + testes**

Run: `npx tsc --noEmit 2>&1 | grep -iE "visitas/" || echo "clean"` ; `npx next lint 2>&1 | grep -iE "visitas/" || echo "lint clean"` ; `npx vitest run tests/unit/visitas-schema.test.ts`
Expected: clean / lint clean / 4 passam.

- [ ] **Step 8: Commit**
```bash
git add src/lib/visitas/ tests/unit/visitas-schema.test.ts
git commit -m "feat(visitas): schema + queries + actions (lead da visita -> leads_gerados)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Páginas + componentes do módulo Visitas

**Files:**
- Create `src/app/(authed)/visitas/page.tsx`, `src/app/(authed)/visitas/[id]/page.tsx`
- Create `src/components/visitas/NovaVisitaButton.tsx`, `src/components/visitas/AdicionarLeadVisitaButton.tsx`

Seguir o padrão de `src/app/(authed)/gerador-leads/page.tsx` (auth + `ALLOWED_ROLES` = ["adm","socio","comercial","coordenador","assessor"]; `getOrganizationId`; `notFound()` se não tiver acesso).

- [ ] **Step 1: `/visitas/page.tsx` (lista)**

Server component: `requireAuth`, checa ALLOWED_ROLES, `getOrganizationId`, `listVisitas(orgId)`. Renderiza um cabeçalho com `<NovaVisitaButton />` e uma lista/tabela das visitas (cada linha: data, título, bairro/cidade, colaborador_nome, `total_leads`, link pra `/visitas/[id]`). KPI opcional: total de visitas. Usar componentes UI existentes (Card, Table) seguindo o estilo do projeto. Cada item linka pra `/visitas/${v.id}`.

- [ ] **Step 2: `/visitas/[id]/page.tsx` (detalhe)**

Server component: auth + ALLOWED_ROLES + orgId; `getVisita(orgId, id)` (notFound se null); lista os leads da visita via `listLeadsGerados(orgId, { visitaId: id, pageSize: 200 })`; renderiza dados da visita + `<AdicionarLeadVisitaButton visitaId={id} />` + **reusa `LeadsTable`** (`@/components/gerador-leads/LeadsTable`) passando `leads` e `canManage`. (Conferir as props exatas de `LeadsTable` lendo o componente.)

- [ ] **Step 3: `NovaVisitaButton.tsx` (client, modal)**

Espelha `src/components/gerador-leads/...` ou `src/components/freela-yide/NovaOportunidadeButton.tsx` (padrão de modal + server action + `router.refresh()`). Campos: `data` (input date, default hoje), `titulo`, `bairro`, `cidade`, `observacoes`. Chama `criarVisitaAction`. Sem emoji/em-dash.

- [ ] **Step 4: `AdicionarLeadVisitaButton.tsx` (client, modal)**

Props: `visitaId`. Campos: `empresa`, `telefone`, `whatsapp`, `contato`, `observacoes`. Hidden `visita_id`. Chama `adicionarLeadVisitaAction` + `router.refresh()`. Sem emoji/em-dash.

- [ ] **Step 5: Type-check + lint + build**

Run: `npx tsc --noEmit 2>&1 | grep -iE "visitas" | grep -v web-push || echo "clean"` ; `npx next lint 2>&1 | grep -iE "visitas" || echo "lint clean"` ; `npx next build 2>&1 | tail -20` (build pode falhar só por deps ausentes do worktree — confirmar que não é dos arquivos novos).

- [ ] **Step 6: Commit**
```bash
git add "src/app/(authed)/visitas/" src/components/visitas/
git commit -m "feat(visitas): páginas de lista/detalhe + modais de visita e lead

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Verificação final + PR

- [ ] **Step 1:** `npx tsc --noEmit 2>&1 | grep -iE "visitas|gerador-leads|nav-config" | grep -v web-push || echo clean` ; `npx next lint 2>&1 | grep -iE "visitas|gerador-leads|nav-config" || echo "lint clean"` ; `npx vitest run 2>&1 | tail -3` (tudo verde).
- [ ] **Step 2:** push + PR (base main). Corpo do PR lista a migration `20260620000000_visitas.sql` (aplicar manual após merge, na ordem) e o resumo. `🤖 Generated with [Claude Code]`.

---

## Notas / riscos
- **Migration manual pós-merge** + aplicar **antes** de o deploy ficar ativo de fato não é possível (auto-deploy) — mas o SELECT novo (`visita_id`) só quebra `/gerador-leads` e `/visitas` se a coluna não existir. Aplicar a migration logo após o merge. O `gerador-leads` já existente continua: o SELECT ganhou `visita_id` → **aplicar a migration assim que mergear** pra não quebrar o Gerador de Leads.
- `leads:leads_gerados(count)` no `listVisitas`: validar o nome do relacionamento; se falhar, fazer contagem separada.
- Reuso de `LeadsTable`: ler as props reais antes de usar no detalhe da visita.
- Sem emoji/em-dash na UI.
