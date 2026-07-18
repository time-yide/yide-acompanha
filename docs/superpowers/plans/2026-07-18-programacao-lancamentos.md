# Módulo de lançamentos da Programação — Implementation Plan (Sub-projeto 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Criar o módulo `/programacao` (lançamento manual de CRM conectado / usuário criado / sistema feito, espelhado no e-commerce) e encaixar a programadora no painel "Produtividade por setor".

**Architecture:** Espelha o módulo `/ecommerce` (tabela `lancamentos_programacao` + lib access/schema/actions/queries + componentes reaproveitando o padrão do form-modal + page + item de menu). Depois estende `setor-metricas` (puro + server) e o painel com o setor "programacao".

**Tech Stack:** Next.js (App Router, Server Actions), TypeScript, Supabase service-role, vitest, Tailwind, lucide-react.

**Branch:** já criada — `feat/programacao-lancamentos` a partir de `origin/main`. Spec commitado. NÃO trocar de branch. Local main vive atrás.

**Nota de testes:** SEMPRE `npx vitest run --exclude '**/.claude/**' <arquivo>`.

**⚠️ Migration MANUAL:** o `.sql` entra no repo mas a Yasmin aplica no SQL Editor após o merge. O código tolera a tabela ausente (fetch volta vazio, não quebra).

---

## File Structure

- **Create** `supabase/migrations/20260718180000_lancamentos_programacao.sql`
- **Create** `src/lib/programacao/tipos.ts`, `access.ts`, `access.test.ts`, `schema.ts`, `actions.ts`, `queries.ts`
- **Create** `src/components/programacao/LancamentoFormModal.tsx`, `NovoLancamentoButton.tsx`, `LancamentosList.tsx`, `FiltroPeriodo.tsx`
- **Create** `src/app/(authed)/programacao/page.tsx`
- **Modify** `src/components/layout/nav-config.ts` (item de menu)
- **Modify** `src/lib/produtividade/setor-metricas.ts` (setor programacao)
- **Modify** `src/lib/produtividade/setor-metricas.test.ts` (novos casos)
- **Modify** `src/lib/produtividade/setor-metricas-server.ts` (query + agregação)
- **Modify** `src/components/produtividade/ProdutividadeSetorSection.tsx` (colunas programacao)

---

## Task 1: Migration + tipos + access (TDD) + schema

**Files:** Create migration, `tipos.ts`, `access.ts`, `access.test.ts`, `schema.ts`.

- [ ] **Step 1: Migration SQL**

Create `supabase/migrations/20260718180000_lancamentos_programacao.sql`:

```sql
-- Setor Programação: registro manual de entregas (CRM conectado, usuário criado,
-- sistema feito) por cliente. Espelha anuncios_ecommerce.
create table if not exists public.lancamentos_programacao (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  colaborador_id uuid references public.profiles(id) on delete set null,
  data date not null default current_date,
  tipo text not null check (tipo in ('crm_conectado','usuario_criado','sistema_feito')),
  quantidade integer not null check (quantidade > 0),
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  arquivado_em timestamptz
);

create index if not exists lancamentos_programacao_org_data_idx
  on public.lancamentos_programacao(organization_id, data desc) where arquivado_em is null;
create index if not exists lancamentos_programacao_client_idx
  on public.lancamentos_programacao(client_id) where arquivado_em is null;
create index if not exists lancamentos_programacao_colaborador_idx
  on public.lancamentos_programacao(colaborador_id) where arquivado_em is null;

drop trigger if exists lancamentos_programacao_set_updated_at on public.lancamentos_programacao;
create trigger lancamentos_programacao_set_updated_at
  before update on public.lancamentos_programacao
  for each row execute function public.set_updated_at();

alter table public.lancamentos_programacao enable row level security;
drop policy if exists lancamentos_programacao_select on public.lancamentos_programacao;
create policy lancamentos_programacao_select on public.lancamentos_programacao for select to authenticated using (true);
drop policy if exists lancamentos_programacao_insert on public.lancamentos_programacao;
create policy lancamentos_programacao_insert on public.lancamentos_programacao for insert to authenticated with check (true);
drop policy if exists lancamentos_programacao_update on public.lancamentos_programacao;
create policy lancamentos_programacao_update on public.lancamentos_programacao for update to authenticated using (true);
```

- [ ] **Step 2: `tipos.ts`**

Create `src/lib/programacao/tipos.ts`:

```ts
export const TIPOS_PROGRAMACAO = ["crm_conectado", "usuario_criado", "sistema_feito"] as const;
export type TipoProgramacao = (typeof TIPOS_PROGRAMACAO)[number];

export const TIPO_LABELS: Record<TipoProgramacao, string> = {
  crm_conectado: "CRM conectado",
  usuario_criado: "Usuário criado",
  sistema_feito: "Sistema feito",
};

export function tipoLabel(t: string): string {
  return (TIPO_LABELS as Record<string, string>)[t] ?? t;
}
```

- [ ] **Step 3: Failing test for access**

Create `src/lib/programacao/access.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { canAccessProgramacao } from "./access";

describe("canAccessProgramacao", () => {
  it("adm/socio/programacao entram", () => {
    expect(canAccessProgramacao("adm")).toBe(true);
    expect(canAccessProgramacao("socio")).toBe(true);
    expect(canAccessProgramacao("programacao")).toBe(true);
  });
  it("outros cargos não entram", () => {
    expect(canAccessProgramacao("assessor")).toBe(false);
    expect(canAccessProgramacao("videomaker")).toBe(false);
    expect(canAccessProgramacao("coordenador")).toBe(false);
  });
});
```

Run `npx vitest run --exclude '**/.claude/**' src/lib/programacao/access.test.ts` → FAIL (module not found).

- [ ] **Step 4: `access.ts`**

Create `src/lib/programacao/access.ts`:

```ts
/**
 * Acesso ao módulo /programacao. FONTE ÚNICA — guarda da página + visibilidade
 * do item no menu. Cargos: adm, sócio, programacao.
 */
export const PROGRAMACAO_ROLES = ["adm", "socio", "programacao"] as const;

export function canAccessProgramacao(role: string): boolean {
  return (PROGRAMACAO_ROLES as readonly string[]).includes(role);
}
```

Run the test again → PASS.

- [ ] **Step 5: `schema.ts`**

Create `src/lib/programacao/schema.ts`:

```ts
import { z } from "zod";
import { TIPOS_PROGRAMACAO } from "./tipos";

const uuidLike = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  "ID inválido",
);

export const criarLancamentoSchema = z.object({
  client_id: uuidLike,
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  tipo: z.enum(TIPOS_PROGRAMACAO),
  quantidade: z.coerce.number().int().min(1, "Quantidade deve ser ≥ 1").max(100000),
  observacao: z.string().trim().max(2000).optional().nullable(),
});

export const updateLancamentoSchema = criarLancamentoSchema.extend({ id: uuidLike });
export const arquivarLancamentoSchema = z.object({ id: uuidLike });
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260718180000_lancamentos_programacao.sql src/lib/programacao/tipos.ts src/lib/programacao/access.ts src/lib/programacao/access.test.ts src/lib/programacao/schema.ts
git commit -m "feat(programacao): migration + tipos + access (com teste) + schema"
```

---

## Task 2: `actions.ts` + `queries.ts`

**Files:** Create `src/lib/programacao/actions.ts`, `src/lib/programacao/queries.ts`.

- [ ] **Step 1: `queries.ts`**

Create `src/lib/programacao/queries.ts`:

```ts
// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { tipoLabel } from "./tipos";

export const CHEFIA_ROLES = ["adm", "socio"] as const;
export function veTudo(role: string): boolean {
  return (CHEFIA_ROLES as readonly string[]).includes(role);
}

export interface ClienteOption {
  id: string;
  nome: string;
}

/** Clientes ativos (não deletados) da organização, pro dropdown. */
export async function listClientesAtivos(orgId: string): Promise<ClienteOption[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data, error } = await sb
    .from("clients")
    .select("id, nome")
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .order("nome");
  if (error) {
    console.error("[programacao] listClientesAtivos", error.message);
    return [];
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    nome: r.nome as string,
  }));
}

export interface LancamentoRow {
  id: string;
  data: string;
  tipo: string;
  tipo_label: string;
  quantidade: number;
  observacao: string | null;
  colaborador_id: string | null;
  colaborador_nome: string | null;
  client_id: string;
  client_nome: string | null;
  created_at: string;
}

export interface ListLancamentosFilters {
  de?: string | null;
  ate?: string | null;
}

/** Lista lançamentos por período. Escopo: veTudo vê todos; senão só os próprios. */
export async function listLancamentos(
  orgId: string,
  role: string,
  actorId: string,
  filters: ListLancamentosFilters = {},
): Promise<LancamentoRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  let q = sb
    .from("lancamentos_programacao")
    .select(
      "id, data, tipo, quantidade, observacao, colaborador_id, client_id, created_at, " +
        "colaborador:profiles!lancamentos_programacao_colaborador_id_fkey(nome), " +
        "client:clients!lancamentos_programacao_client_id_fkey(nome)",
    )
    .eq("organization_id", orgId)
    .is("arquivado_em", null);

  if (!veTudo(role)) q = q.eq("colaborador_id", actorId);
  if (filters.de) q = q.gte("data", filters.de);
  if (filters.ate) q = q.lte("data", filters.ate);
  q = q.order("data", { ascending: false }).order("created_at", { ascending: false });

  const { data, error } = await q;
  if (error) {
    console.error("[programacao] listLancamentos", error.message);
    return [];
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    data: r.data as string,
    tipo: r.tipo as string,
    tipo_label: tipoLabel(r.tipo as string),
    quantidade: Number(r.quantidade ?? 0),
    observacao: (r.observacao as string | null) ?? null,
    colaborador_id: (r.colaborador_id as string | null) ?? null,
    colaborador_nome: ((r.colaborador as { nome?: string } | null) ?? null)?.nome ?? null,
    client_id: r.client_id as string,
    client_nome: ((r.client as { nome?: string } | null) ?? null)?.nome ?? null,
    created_at: r.created_at as string,
  }));
}
```

- [ ] **Step 2: `actions.ts`**

Create `src/lib/programacao/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { canAccessProgramacao } from "./access";
import { veTudo } from "./queries";
import {
  criarLancamentoSchema,
  updateLancamentoSchema,
  arquivarLancamentoSchema,
} from "./schema";

interface Ok { success: true }
interface Err { error: string }
type Result = Ok | Err;

function fd(f: FormData, k: string): string | null {
  const v = f.get(k);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export async function criarLancamentoAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  if (!canAccessProgramacao(actor.role)) return { error: "Sem permissão" };
  const parsed = criarLancamentoSchema.safeParse({
    client_id: fd(formData, "client_id"),
    data: fd(formData, "data"),
    tipo: fd(formData, "tipo"),
    quantidade: fd(formData, "quantidade"),
    observacao: fd(formData, "observacao"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const orgId = await getOrganizationId(actor.id);
  if (!orgId) return { error: "Organização não encontrada" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data: cli } = await sb
    .from("clients")
    .select("id")
    .eq("id", parsed.data.client_id)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!cli) return { error: "Cliente não encontrado" };

  const { error } = await sb.from("lancamentos_programacao").insert({
    organization_id: orgId,
    client_id: parsed.data.client_id,
    colaborador_id: actor.id,
    data: parsed.data.data,
    tipo: parsed.data.tipo,
    quantidade: parsed.data.quantidade,
    observacao: parsed.data.observacao,
  });
  if (error) return { error: error.message };
  revalidatePath("/programacao");
  return { success: true };
}

export async function updateLancamentoAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  if (!canAccessProgramacao(actor.role)) return { error: "Sem permissão" };
  const parsed = updateLancamentoSchema.safeParse({
    id: fd(formData, "id"),
    client_id: fd(formData, "client_id"),
    data: fd(formData, "data"),
    tipo: fd(formData, "tipo"),
    quantidade: fd(formData, "quantidade"),
    observacao: fd(formData, "observacao"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const orgId = await getOrganizationId(actor.id);
  if (!orgId) return { error: "Organização não encontrada" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  let q = sb
    .from("lancamentos_programacao")
    .update({
      client_id: parsed.data.client_id,
      data: parsed.data.data,
      tipo: parsed.data.tipo,
      quantidade: parsed.data.quantidade,
      observacao: parsed.data.observacao,
    })
    .eq("id", parsed.data.id)
    .eq("organization_id", orgId);
  if (!veTudo(actor.role)) q = q.eq("colaborador_id", actor.id);
  const { data, error } = await q.select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Nada para atualizar" };
  revalidatePath("/programacao");
  return { success: true };
}

export async function arquivarLancamentoAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  if (!canAccessProgramacao(actor.role)) return { error: "Sem permissão" };
  const parsed = arquivarLancamentoSchema.safeParse({ id: fd(formData, "id") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const orgId = await getOrganizationId(actor.id);
  if (!orgId) return { error: "Organização não encontrada" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  let q = sb
    .from("lancamentos_programacao")
    .update({ arquivado_em: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("organization_id", orgId);
  if (!veTudo(actor.role)) q = q.eq("colaborador_id", actor.id);
  const { data, error } = await q.select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Nada para arquivar" };
  revalidatePath("/programacao");
  return { success: true };
}
```

- [ ] **Step 3: Type-check + commit**

Run `npx tsc --noEmit` (sem erros).
```bash
git add src/lib/programacao/actions.ts src/lib/programacao/queries.ts
git commit -m "feat(programacao): actions (criar/editar/arquivar) + queries"
```

---

## Task 3: Componentes (form modal, botão, lista, filtro)

**Files:** Create the 4 components under `src/components/programacao/`.

- [ ] **Step 1: `LancamentoFormModal.tsx`**

Create `src/components/programacao/LancamentoFormModal.tsx`:

```tsx
"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TIPOS_PROGRAMACAO, TIPO_LABELS } from "@/lib/programacao/tipos";

export interface LancamentoInitial {
  id?: string;
  client_id?: string;
  data?: string;
  tipo?: string;
  quantidade?: number;
  observacao?: string | null;
}

interface Props {
  clientes: { id: string; nome: string }[];
  titulo: string;
  initial?: LancamentoInitial;
  action: (fd: FormData) => Promise<{ success: true } | { error: string }>;
  onClose: () => void;
  onDone: () => void;
}

export function LancamentoFormModal({ clientes, titulo, initial, action, onClose, onDone }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const hoje = new Date().toISOString().slice(0, 10);

  function submit(formData: FormData) {
    setError(null);
    start(async () => {
      const r = await action(formData);
      if ("error" in r) { setError(r.error); return; }
      onDone();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <form
        action={submit}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lancamento-form-titulo"
        className="w-full max-w-md space-y-3 rounded-xl border bg-card p-5"
      >
        <h2 id="lancamento-form-titulo" className="font-semibold">{titulo}</h2>
        {initial?.id && <input type="hidden" name="id" value={initial.id} />}

        <div className="space-y-1.5">
          <Label htmlFor="client_id">Cliente</Label>
          <select
            id="client_id"
            name="client_id"
            required
            defaultValue={initial?.client_id ?? ""}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">Selecione…</option>
            {clientes.map((c) => (<option key={c.id} value={c.id}>{c.nome}</option>))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tipo">Tipo</Label>
          <select
            id="tipo"
            name="tipo"
            required
            defaultValue={initial?.tipo ?? TIPOS_PROGRAMACAO[0]}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {TIPOS_PROGRAMACAO.map((t) => (<option key={t} value={t}>{TIPO_LABELS[t]}</option>))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="quantidade">Quantidade</Label>
            <Input id="quantidade" name="quantidade" type="number" min={1} required defaultValue={initial?.quantidade ?? 1} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="data">Data</Label>
            <Input id="data" name="data" type="date" required defaultValue={initial?.data ?? hoje} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="observacao">Observação (opcional)</Label>
          <Textarea id="observacao" name="observacao" rows={2} maxLength={2000} defaultValue={initial?.observacao ?? ""} />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</Button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: `NovoLancamentoButton.tsx`**

Create `src/components/programacao/NovoLancamentoButton.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { criarLancamentoAction } from "@/lib/programacao/actions";
import { LancamentoFormModal } from "./LancamentoFormModal";

interface Props {
  clientes: { id: string; nome: string }[];
}

export function NovoLancamentoButton({ clientes }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const semClientes = clientes.length === 0;

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} disabled={semClientes}>
        <Plus className="h-4 w-4" /> Novo lançamento
      </Button>
      {open && (
        <LancamentoFormModal
          clientes={clientes}
          titulo="Novo lançamento de programação"
          action={criarLancamentoAction}
          onClose={() => setOpen(false)}
          onDone={() => { setOpen(false); router.refresh(); }}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: `LancamentosList.tsx`**

Create `src/components/programacao/LancamentosList.tsx`:

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { arquivarLancamentoAction, updateLancamentoAction } from "@/lib/programacao/actions";
import type { LancamentoRow } from "@/lib/programacao/queries";
import { LancamentoFormModal } from "./LancamentoFormModal";

function formatarDataBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

interface Props {
  lancamentos: LancamentoRow[];
  clientes: { id: string; nome: string }[];
  mostrarColaborador: boolean;
}

export function LancamentosList({ lancamentos, clientes, mostrarColaborador }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editando, setEditando] = useState<LancamentoRow | null>(null);

  function arquivar(id: string) {
    if (!confirm("Arquivar este lançamento?")) return;
    start(async () => {
      const fd = new FormData();
      fd.set("id", id);
      const r = await arquivarLancamentoAction(fd);
      if ("error" in r) { alert(r.error); return; }
      router.refresh();
    });
  }

  if (lancamentos.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum lançamento no período.</p>;
  }

  return (
    <div className="space-y-2">
      {lancamentos.map((l) => (
        <div key={l.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border bg-card p-3">
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-semibold truncate">
              {l.client_nome ?? "—"}
              <span className="ml-2 rounded-full border bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums">
                {l.quantidade}× {l.tipo_label}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {formatarDataBR(l.data)}
              {mostrarColaborador && l.colaborador_nome ? <span> &middot; {l.colaborador_nome}</span> : null}
            </p>
            {l.observacao ? <p className="text-xs text-muted-foreground">{l.observacao}</p> : null}
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" size="icon" variant="ghost" onClick={() => setEditando(l)} aria-label="Editar">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" disabled={pending} onClick={() => arquivar(l.id)} aria-label="Arquivar">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}

      {editando && (
        <LancamentoFormModal
          key={editando.id}
          clientes={clientes}
          titulo="Editar lançamento"
          initial={{
            id: editando.id,
            client_id: editando.client_id,
            data: editando.data,
            tipo: editando.tipo,
            quantidade: editando.quantidade,
            observacao: editando.observacao,
          }}
          action={updateLancamentoAction}
          onClose={() => setEditando(null)}
          onDone={() => { setEditando(null); router.refresh(); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: `FiltroPeriodo.tsx`**

Create `src/components/programacao/FiltroPeriodo.tsx`:

```tsx
"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  de: string;
  ate: string;
}

export function FiltroPeriodo({ de, ate }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(key: "de" | "ate", value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="de" className="text-xs">De</Label>
        <Input id="de" type="date" defaultValue={de} onChange={(e) => update("de", e.target.value)} className="h-9" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="ate" className="text-xs">Até</Label>
        <Input id="ate" type="date" defaultValue={ate} onChange={(e) => update("ate", e.target.value)} className="h-9" />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Type-check + lint + commit**

Run `npx tsc --noEmit` (page.tsx ainda não existe → sem erro por isso; erros só se houver nos componentes) e `npx eslint src/components/programacao/`.
```bash
git add src/components/programacao/
git commit -m "feat(programacao): componentes (form modal, botão, lista, filtro)"
```

---

## Task 4: Página `/programacao` + item de menu

**Files:** Create `src/app/(authed)/programacao/page.tsx`; Modify `src/components/layout/nav-config.ts`.

- [ ] **Step 1: `page.tsx`**

Create `src/app/(authed)/programacao/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { canAccessProgramacao } from "@/lib/programacao/access";
import { listClientesAtivos, listLancamentos, veTudo } from "@/lib/programacao/queries";
import { NovoLancamentoButton } from "@/components/programacao/NovoLancamentoButton";
import { LancamentosList } from "@/components/programacao/LancamentosList";
import { FiltroPeriodo } from "@/components/programacao/FiltroPeriodo";

export const dynamic = "force-dynamic";

function inicioDoMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function ProgramacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string }>;
}) {
  const user = await requireAuth();
  if (!canAccessProgramacao(user.role)) notFound();
  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();

  const sp = await searchParams;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const de = sp.de && DATE_RE.test(sp.de) ? sp.de : inicioDoMes();
  const ate = sp.ate && DATE_RE.test(sp.ate) ? sp.ate : hoje();
  const chefia = veTudo(user.role);

  const [clientes, lancamentos] = await Promise.all([
    listClientesAtivos(orgId),
    listLancamentos(orgId, user.role, user.id, { de, ate }),
  ]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Programação</h1>
          <p className="text-sm text-muted-foreground">
            Registre CRM conectados, usuários criados e sistemas feitos por cliente.
          </p>
        </div>
        <NovoLancamentoButton clientes={clientes} />
      </header>

      {clientes.length === 0 && (
        <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          Nenhum cliente ativo cadastrado ainda.
        </p>
      )}

      <FiltroPeriodo de={de} ate={ate} />

      <LancamentosList lancamentos={lancamentos} clientes={clientes} mostrarColaborador={chefia} />
    </div>
  );
}
```

- [ ] **Step 2: Item de menu em `nav-config.ts`**

Em `src/components/layout/nav-config.ts`:
- No import de ícones do `lucide-react` (linhas ~1-7), adiciona `Code2` à lista importada.
- No grupo `id: "operacao"`, logo APÓS a linha do E-commerce (`{ type: "link", href: "/ecommerce", ... }`), adiciona:
```ts
      { type: "link", href: "/programacao", icon: Code2, label: "Programação", roles: ["adm", "socio", "programacao"], badgeKey: null },
```
> Não precisa de override em `isLinkVisible`: adm/socio caem no check geral (`roles.includes`), e o cargo `programacao` já é gateado pra ver só links que listam `"programacao"` (linha ~143). Como a entrada lista `"programacao"`, ela aparece pra ela.

- [ ] **Step 3: Type-check + lint + commit**

Run `npx tsc --noEmit && npx eslint "src/app/(authed)/programacao/page.tsx" src/components/layout/nav-config.ts` (limpo).
```bash
git add "src/app/(authed)/programacao/page.tsx" src/components/layout/nav-config.ts
git commit -m "feat(programacao): página /programacao + item no menu"
```

---

## Task 5: Setor `programacao` no módulo puro `setor-metricas.ts` + testes

**Files:** Modify `src/lib/produtividade/setor-metricas.ts`, `src/lib/produtividade/setor-metricas.test.ts`.

- [ ] **Step 1: Estende o módulo puro**

Em `src/lib/produtividade/setor-metricas.ts`:

(a) Adiciona `"programacao"` ao tipo `Setor`:
```ts
export type Setor = "comercial" | "ecommerce" | "assessoria" | "design" | "audiovisual" | "programacao";
```
(b) Adiciona os campos ao `MetricaCrua` (no fim da interface):
```ts
  prog_crm: number;
  prog_usuarios: number;
  prog_sistemas: number;
  prog_total: number;
```
(c) Em `roleParaSetor`, adiciona ANTES do `if (AUDIOVISUAL.has(role))`:
```ts
  if (role === "programacao") return "programacao";
```
(d) Em `resolveMetricaPessoa`, adiciona um `case` antes do `default`:
```ts
    case "programacao":
      return { setor, valor: c.prog_total, unidade: "contagem", rotulo: plural(c.prog_total, "entrega", "entregas") };
```

- [ ] **Step 2: Atualiza os testes**

Em `src/lib/produtividade/setor-metricas.test.ts`:
- No `describe("roleParaSetor")`, troca a asserção `expect(roleParaSetor("programacao")).toBeNull();` por:
```ts
    expect(roleParaSetor("programacao")).toBe("programacao");
```
- No helper `crua` do `describe("resolveMetricaPessoa")`, adiciona os novos campos ao objeto base:
```ts
    prog_crm: 0, prog_usuarios: 0, prog_sistemas: 0, prog_total: 0,
```
- Adiciona um teste dentro do `describe("resolveMetricaPessoa")`:
```ts
  it("programacao → total de entregas", () => {
    expect(resolveMetricaPessoa("programacao", null, crua({ prog_total: 12 })).rotulo).toBe("12 entregas");
    expect(resolveMetricaPessoa("programacao", null, crua({ prog_total: 1 })).rotulo).toBe("1 entrega");
  });
```

- [ ] **Step 3: Roda o teste + commit**

Run `npx vitest run --exclude '**/.claude/**' src/lib/produtividade/setor-metricas.test.ts` → PASS.

> NÃO rode `npx tsc --noEmit` nesta task: adicionar os campos obrigatórios ao `MetricaCrua` deixa o `zero()` do `setor-metricas-server.ts` (e o `TITULO_SETOR`/`valorChaveSetor`, que não conhecem o setor "programacao") **temporariamente incompletos** → tsc acusa erro no server. Isso é esperado e é corrigido na Task 6. Só o vitest do arquivo puro importa aqui.

```bash
git add src/lib/produtividade/setor-metricas.ts src/lib/produtividade/setor-metricas.test.ts
git commit -m "feat(produtividade): setor programacao no resolver puro + testes"
```

---

## Task 6: Query + agregação no server + coluna no painel

**Files:** Modify `src/lib/produtividade/setor-metricas-server.ts`, `src/components/produtividade/ProdutividadeSetorSection.tsx`.

- [ ] **Step 1: `setor-metricas-server.ts`**

(a) `TITULO_SETOR` — adiciona a entrada:
```ts
  programacao: "Programação",
```
(b) `SETORES_PAINEL` — adiciona `"programacao"`:
```ts
const SETORES_PAINEL: Setor[] = ["comercial", "ecommerce", "assessoria", "design", "programacao"];
```
(c) `valorChaveSetor` — adiciona o case:
```ts
    case "programacao": return p.prog_total;
```
(d) A função `zero()` (dentro de `_getProdutividadeSetorImpl`) — adiciona os campos:
```ts
    prog_crm: 0, prog_usuarios: 0, prog_sistemas: 0, prog_total: 0,
```
(e) No `Promise.all`, adiciona uma query no final da lista (e o nome correspondente na desestruturação — `{ data: progData }`):
```ts
    sb.from("lancamentos_programacao").select("colaborador_id, tipo, quantidade")
      .is("arquivado_em", null).gte("data", since).lte("data", today)
      .not("colaborador_id", "is", null),
```
(f) Após os outros loops de agregação (depois do loop de `artes`), adiciona:
```ts
  for (const l of (progData ?? []) as Array<{ colaborador_id: string; tipo: string; quantidade: number }>) {
    const m = get(l.colaborador_id);
    const qtd = Number(l.quantidade ?? 0);
    m.prog_total += qtd;
    if (l.tipo === "crm_conectado") m.prog_crm += qtd;
    else if (l.tipo === "usuario_criado") m.prog_usuarios += qtd;
    else if (l.tipo === "sistema_feito") m.prog_sistemas += qtd;
  }
```
(g) Bumpa a key do cache (mudou o shape): `["produtividade-setor-v1"]` → `["produtividade-setor-v2"]`.

- [ ] **Step 2: `ProdutividadeSetorSection.tsx` — colunas do bloco programacao**

No `const COLUNAS`, adiciona a entrada `programacao`:
```ts
  programacao: [
    { titulo: "CRMs", valor: (p) => p.prog_crm },
    { titulo: "Usuários", valor: (p) => p.prog_usuarios },
    { titulo: "Sistemas", valor: (p) => p.prog_sistemas },
    { titulo: "Total", valor: (p) => p.prog_total },
  ],
```

- [ ] **Step 3: Type-check + commit**

Run `npx tsc --noEmit` (limpo).
```bash
git add src/lib/produtividade/setor-metricas-server.ts src/components/produtividade/ProdutividadeSetorSection.tsx
git commit -m "feat(produtividade): agrega lancamentos_programacao + bloco Programação no painel"
```

---

## Task 7: PR

- [ ] **Step 1: Verificação final**

Run `npx tsc --noEmit && npx vitest run --exclude '**/.claude/**' src/lib/programacao/access.test.ts src/lib/produtividade/setor-metricas.test.ts`
Expected: tsc limpo; testes verdes.

- [ ] **Step 2: Push + PR**

```bash
git push -u origin feat/programacao-lancamentos
gh pr create --base main --title "feat(programacao): módulo de lançamentos + programadora no painel de produtividade" --body "$(cat <<'EOF'
## O que muda
- **Módulo `/programacao`** (espelhado no e-commerce): a programadora registra **CRM conectado / usuário criado / sistema feito** por cliente (quantidade, data, observação). Criar/editar/arquivar; cada um vê os próprios, chefia vê todos. Item no menu pra adm/sócio/programacao.
- **Painel de produtividade**: novo setor **Programação** — coluna "Produtividade" da programadora = total de lançamentos ("N entregas"); bloco no painel com CRMs · Usuários · Sistemas · Total.

⚠️ **Migration MANUAL:** aplicar `supabase/migrations/20260718180000_lancamentos_programacao.sql` no SQL Editor após o merge. Sem isso o módulo mostra vazio (não quebra).

Spec: `docs/superpowers/specs/2026-07-18-programacao-lancamentos-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: CI verde → merge**

Espera o check `test` verde, então `gh pr merge --squash --delete-branch`. **Depois, lembrar a Yasmin de rodar o SQL da migration.**

---

## Notas de verificação manual (pós-deploy + migration)

- Logada como programadora: vê "Programação" no menu; consegue criar/editar/arquivar lançamento.
- No /produtividade (adm/sócio): a programadora mostra "N entregas" na coluna Produtividade; aparece o bloco "Programação" com CRMs/Usuários/Sistemas/Total.
- Cliente obrigatório; sem clientes → botão desabilitado.

## Riscos / suposições

- Migration manual: enquanto não rodar, `lancamentos_programacao` não existe → queries voltam vazias (catch + log), painel mostra 0. Não quebra.
- Cliente = qualquer cliente não-deletado da org (sem filtro de pacote), por decisão do spec.
- Cache key bumpada (v2) porque o shape do MetricaCrua mudou.
