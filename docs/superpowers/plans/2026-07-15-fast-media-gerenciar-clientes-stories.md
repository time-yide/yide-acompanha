# Fast Mídia — gerenciar clientes de stories — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir adicionar cliente à grade de stories do `/fast-media` com quantidade diária, editar essa quantidade, remover da grade, e tornar o nome do cliente um link pra ficha — tudo sem migration.

**Architecture:** Reusa as colunas `clients.tem_stories` e `clients.quantidade_diaria_stories`. Três server actions novas em `stories-actions.ts` rodam via **service-role** (fast_midia não tem RLS de UPDATE em `clients`), protegidas por gate de role + validação de unidade. Uma query nova lista clientes elegíveis. Um dialog novo (espelha `AdicionarGmbDialog`) e edições no `StoriesMonthGrid` cobrem a UI.

**Tech Stack:** Next.js (App Router), TypeScript, Supabase (service-role), Zod, React (client components), sonner (toasts), Vitest.

---

## File Structure

- **Create:** `src/components/fast-media/AdicionarClienteStoriesDialog.tsx` — botão + dialog pra adicionar cliente à grade.
- **Create:** `tests/unit/stories-manage-actions.test.ts` — testes das 3 actions novas.
- **Modify:** `src/lib/painel/stories-queries.ts` — nova `getClientesElegiveisStories`.
- **Modify:** `src/lib/painel/stories-actions.ts` — 3 actions novas.
- **Modify:** `src/components/fast-media/StoriesMonthGrid.tsx` — nome vira link + dialog editar/remover por card.
- **Modify:** `src/app/(authed)/fast-media/page.tsx` — carrega elegíveis + renderiza botão.

Convenções do arquivo `stories-actions.ts` que serão reusadas (já existem no topo dele): `ALLOWED_ROLES = ["fast_midia","adm","socio","coordenador"]`, `uuidLike` (regex de UUID), `requireAuth`.

---

## Task 1: Query de clientes elegíveis

**Files:**
- Modify: `src/lib/painel/stories-queries.ts` (adicionar no fim do arquivo)

- [ ] **Step 1: Adicionar a interface e a função**

Adicione ao final de `src/lib/painel/stories-queries.ts` (o arquivo já importa `createServiceRoleClient` no topo):

```ts
export interface ClienteElegivelStories {
  id: string;
  nome: string;
}

/**
 * Clientes que PODEM entrar na grade de stories: status 'ativo' e ainda sem
 * stories ativado. Serve o seletor do dialog "Adicionar cliente" no /fast-media.
 * Filtra pela unidade ativa (unitClientIds); service-role, mesmo padrão das
 * demais queries deste arquivo.
 */
export async function getClientesElegiveisStories(
  unitClientIds: string[] | null,
): Promise<ClienteElegivelStories[]> {
  // Unidade nova sem clientes → nada elegível.
  if (unitClientIds !== null && unitClientIds.length === 0) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceRoleClient() as any;

  let q = supabase
    .from("clients")
    .select("id, nome")
    .eq("status", "ativo")
    .eq("tem_stories", false);
  if (unitClientIds !== null) q = q.in("id", unitClientIds);

  const { data, error } = await q.order("nome");
  if (error) {
    console.error("[painel/stories] erro ao listar elegíveis:", error.message);
    return [];
  }
  return ((data ?? []) as Array<{ id: string; nome: string }>).sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR"),
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run typecheck`
Expected: PASS (sem novos erros).

- [ ] **Step 3: Commit**

```bash
git add src/lib/painel/stories-queries.ts
git commit -m "feat(fast-media): query de clientes elegíveis pra stories"
```

---

## Task 2: Server actions (add / editar diária / remover)

**Files:**
- Modify: `src/lib/painel/stories-actions.ts` (imports no topo + 3 actions no fim)

- [ ] **Step 1: Adicionar imports**

No topo de `src/lib/painel/stories-actions.ts`, logo abaixo da linha `import { requireAuth } from "@/lib/auth/session";`, adicione:

```ts
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getClientIdsForActiveUnit } from "@/lib/units/filter-helpers";
```

- [ ] **Step 2: Adicionar as 3 actions no fim do arquivo**

Adicione ao final de `src/lib/painel/stories-actions.ts` (reusa `ALLOWED_ROLES` e `uuidLike` já definidos no topo do arquivo):

```ts
// ── Gerenciamento de clientes na grade de stories ────────────────────────────
// Usa service-role: fast_midia NÃO tem policy de UPDATE em `clients` (a policy
// cobre adm/socio/coordenador/assessor — ver gmb-actions.ts), mas precisa
// gerenciar a grade. Proteção = gate de role (ALLOWED_ROLES) + validação de
// unidade (client_id precisa estar na unidade ativa).

/** Verifica que o client_id alvo está na unidade ativa (quando há filtro). */
async function clienteNaUnidadeAtiva(clientId: string): Promise<boolean> {
  const unitClientIds = await getClientIdsForActiveUnit();
  if (unitClientIds === null) return true; // sem filtro de unidade
  return unitClientIds.includes(clientId);
}

const addClienteStoriesSchema = z.object({
  client_id: uuidLike,
  quantidade_diaria: z.coerce.number().int().min(1).max(99),
});

/**
 * Adiciona um cliente já existente à grade de stories: liga tem_stories e grava
 * a quantidade diária. Só clientes 'ativo'.
 */
export async function addClienteStoriesAction(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const actor = await requireAuth();
  if (!(ALLOWED_ROLES as readonly string[]).includes(actor.role)) {
    return { error: "Sem permissão" };
  }

  const parsed = addClienteStoriesSchema.safeParse({
    client_id: formData.get("client_id"),
    quantidade_diaria: formData.get("quantidade_diaria"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { client_id, quantidade_diaria } = parsed.data;
  if (!(await clienteNaUnidadeAtiva(client_id))) {
    return { error: "Cliente fora da unidade ativa" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceRoleClient() as any;
  const { data, error } = await supabase
    .from("clients")
    .update({ tem_stories: true, quantidade_diaria_stories: quantidade_diaria })
    .eq("id", client_id)
    .eq("status", "ativo")
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Cliente não encontrado ou inativo" };

  revalidatePath("/fast-media");
  revalidatePath("/painel");
  return { success: true };
}

const updateDiariaSchema = z.object({
  client_id: uuidLike,
  quantidade_diaria: z.coerce.number().int().min(1).max(99),
});

/** Edita a quantidade diária de um cliente que já está na grade. */
export async function updateClienteDiariaStoriesAction(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const actor = await requireAuth();
  if (!(ALLOWED_ROLES as readonly string[]).includes(actor.role)) {
    return { error: "Sem permissão" };
  }

  const parsed = updateDiariaSchema.safeParse({
    client_id: formData.get("client_id"),
    quantidade_diaria: formData.get("quantidade_diaria"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { client_id, quantidade_diaria } = parsed.data;
  if (!(await clienteNaUnidadeAtiva(client_id))) {
    return { error: "Cliente fora da unidade ativa" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceRoleClient() as any;
  const { data, error } = await supabase
    .from("clients")
    .update({ quantidade_diaria_stories: quantidade_diaria })
    .eq("id", client_id)
    .eq("tem_stories", true)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Cliente não está na grade" };

  revalidatePath("/fast-media");
  revalidatePath("/painel");
  return { success: true };
}

const removeClienteStoriesSchema = z.object({ client_id: uuidLike });

/**
 * Remove o cliente da grade de stories (desliga tem_stories). Mantém o
 * histórico de marcações (client_story_posts / client_monthly_stories); se
 * readicionar depois, os stories já marcados reaparecem.
 */
export async function removeClienteStoriesAction(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const actor = await requireAuth();
  if (!(ALLOWED_ROLES as readonly string[]).includes(actor.role)) {
    return { error: "Sem permissão" };
  }

  const parsed = removeClienteStoriesSchema.safeParse({
    client_id: formData.get("client_id"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { client_id } = parsed.data;
  if (!(await clienteNaUnidadeAtiva(client_id))) {
    return { error: "Cliente fora da unidade ativa" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceRoleClient() as any;
  const { data, error } = await supabase
    .from("clients")
    .update({ tem_stories: false })
    .eq("id", client_id)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Cliente não encontrado" };

  revalidatePath("/fast-media");
  revalidatePath("/painel");
  return { success: true };
}
```

- [ ] **Step 3: Type-check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/painel/stories-actions.ts
git commit -m "feat(fast-media): actions add/editar/remover cliente na grade de stories"
```

---

## Task 3: Testes das actions

**Files:**
- Create: `tests/unit/stories-manage-actions.test.ts`

- [ ] **Step 1: Escrever os testes (que devem falhar antes das actions existirem — mas as actions já foram criadas na Task 2, então servem de verificação)**

Crie `tests/unit/stories-manage-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());
const requireAuthMock = vi.hoisted(() => vi.fn());
const unitIdsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({ requireAuth: requireAuthMock }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => ({ from: fromMock }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: fromMock }) }));
vi.mock("@/lib/units/filter-helpers", () => ({
  getClientIdsForActiveUnit: unitIdsMock,
  getProfileIdsForActiveUnit: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import {
  addClienteStoriesAction,
  updateClienteDiariaStoriesAction,
  removeClienteStoriesAction,
} from "@/lib/painel/stories-actions";

const CID = "1a9a33c5-afde-4df5-92c6-6784500e6d91";

function fd(obj: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}

/** Mock chainable de clients.update(...).eq(...)[.eq(...)].select(...) */
function mockClientsUpdate(result: { data: unknown; error: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  chain.eq = vi.fn(() => chain);
  chain.select = vi.fn(() => Promise.resolve(result));
  const update = vi.fn(() => chain);
  fromMock.mockImplementation((t: string) => (t === "clients" ? { update } : {}));
  return { update, chain };
}

beforeEach(() => {
  fromMock.mockReset();
  requireAuthMock.mockReset();
  unitIdsMock.mockReset().mockResolvedValue(null); // null = sem filtro de unidade
});

describe("addClienteStoriesAction", () => {
  it("liga tem_stories e grava a diária", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "fast_midia" });
    const { update } = mockClientsUpdate({ data: [{ id: CID }], error: null });
    const r = await addClienteStoriesAction(fd({ client_id: CID, quantidade_diaria: "3" }));
    expect(r.error).toBeUndefined();
    expect(r.success).toBe(true);
    expect(update).toHaveBeenCalledWith({ tem_stories: true, quantidade_diaria_stories: 3 });
  });

  it("bloqueia role sem permissão", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "videomaker" });
    mockClientsUpdate({ data: [{ id: CID }], error: null });
    const r = await addClienteStoriesAction(fd({ client_id: CID, quantidade_diaria: "3" }));
    expect(r.error).toBe("Sem permissão");
  });

  it("rejeita cliente fora da unidade ativa", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "coordenador" });
    unitIdsMock.mockResolvedValue(["outro-id"]);
    mockClientsUpdate({ data: [{ id: CID }], error: null });
    const r = await addClienteStoriesAction(fd({ client_id: CID, quantidade_diaria: "3" }));
    expect(r.error).toBe("Cliente fora da unidade ativa");
  });

  it("rejeita quantidade fora de 1..99", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "fast_midia" });
    mockClientsUpdate({ data: [{ id: CID }], error: null });
    const r = await addClienteStoriesAction(fd({ client_id: CID, quantidade_diaria: "0" }));
    expect(r.error).toBeTruthy();
    expect(r.success).toBeUndefined();
  });

  it("erro quando update não afeta linha (cliente inativo)", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "fast_midia" });
    mockClientsUpdate({ data: [], error: null });
    const r = await addClienteStoriesAction(fd({ client_id: CID, quantidade_diaria: "3" }));
    expect(r.error).toBe("Cliente não encontrado ou inativo");
  });
});

describe("updateClienteDiariaStoriesAction", () => {
  it("atualiza só a diária", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "fast_midia" });
    const { update } = mockClientsUpdate({ data: [{ id: CID }], error: null });
    const r = await updateClienteDiariaStoriesAction(fd({ client_id: CID, quantidade_diaria: "5" }));
    expect(r.success).toBe(true);
    expect(update).toHaveBeenCalledWith({ quantidade_diaria_stories: 5 });
  });

  it("erro quando cliente não está na grade", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "fast_midia" });
    mockClientsUpdate({ data: [], error: null });
    const r = await updateClienteDiariaStoriesAction(fd({ client_id: CID, quantidade_diaria: "5" }));
    expect(r.error).toBe("Cliente não está na grade");
  });
});

describe("removeClienteStoriesAction", () => {
  it("desliga tem_stories", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "fast_midia" });
    const { update } = mockClientsUpdate({ data: [{ id: CID }], error: null });
    const r = await removeClienteStoriesAction(fd({ client_id: CID }));
    expect(r.success).toBe(true);
    expect(update).toHaveBeenCalledWith({ tem_stories: false });
  });

  it("bloqueia role sem permissão", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "assessor" });
    mockClientsUpdate({ data: [{ id: CID }], error: null });
    const r = await removeClienteStoriesAction(fd({ client_id: CID }));
    expect(r.error).toBe("Sem permissão");
  });
});
```

- [ ] **Step 2: Rodar os testes**

Run: `npx vitest run tests/unit/stories-manage-actions.test.ts`
Expected: PASS (todos os testes verdes).

- [ ] **Step 3: Commit**

```bash
git add tests/unit/stories-manage-actions.test.ts
git commit -m "test(fast-media): actions de gerenciar stories"
```

---

## Task 4: Dialog "Adicionar cliente"

**Files:**
- Create: `src/components/fast-media/AdicionarClienteStoriesDialog.tsx`

- [ ] **Step 1: Criar o componente**

Crie `src/components/fast-media/AdicionarClienteStoriesDialog.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { addClienteStoriesAction } from "@/lib/painel/stories-actions";
import type { ClienteElegivelStories } from "@/lib/painel/stories-queries";

interface Props {
  clientesElegiveis: ClienteElegivelStories[];
}

/**
 * Botão + Dialog pra adicionar um cliente da carteira à grade de stories,
 * definindo a quantidade diária — direto do /fast-media, sem ir na ficha.
 */
export function AdicionarClienteStoriesDialog({ clientesElegiveis }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState<string>("");
  const [diaria, setDiaria] = useState<string>("1");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!clientId) {
      toast.error("Selecione o cliente");
      return;
    }
    const n = Number(diaria);
    if (!Number.isInteger(n) || n < 1 || n > 99) {
      toast.error("Quantidade diária deve ser de 1 a 99");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("client_id", clientId);
      fd.set("quantidade_diaria", String(n));
      const r = await addClienteStoriesAction(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Cliente adicionado à grade de stories");
      setClientId("");
      setDiaria("1");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-4 w-4" />
        Adicionar cliente
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar cliente à grade de stories</DialogTitle>
            <DialogDescription>
              Escolha um cliente da carteira e defina quantos stories por dia.
            </DialogDescription>
          </DialogHeader>

          {clientesElegiveis.length === 0 ? (
            <div className="space-y-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-300">
                Nenhum cliente elegível pra adicionar agora.
              </p>
              <p className="text-xs text-muted-foreground">
                Todos os clientes ativos desta unidade já estão na grade de stories.
              </p>
              <DialogFooter>
                <Button type="button" onClick={() => setOpen(false)}>
                  Fechar
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Cliente</Label>
                <SearchableSelect
                  options={clientesElegiveis.map((c) => ({ value: c.id, label: c.nome }))}
                  value={clientId || null}
                  onChange={(v) => setClientId(v ?? "")}
                  placeholder="Selecione o cliente"
                  emptyText="Nenhum cliente encontrado"
                  disabled={pending}
                />
                <p className="text-[11px] text-muted-foreground">
                  Lista filtrada: só clientes ativos que ainda não estão na grade.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="diaria">Stories por dia</Label>
                <Input
                  id="diaria"
                  type="number"
                  min={1}
                  max={99}
                  step={1}
                  value={diaria}
                  onChange={(e) => setDiaria(e.target.value)}
                  disabled={pending}
                />
                <p className="text-[11px] text-muted-foreground">
                  A meta do mês vira este número × dias do mês.
                </p>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={pending || !clientId}>
                  {pending ? "Adicionando..." : "Adicionar"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/fast-media/AdicionarClienteStoriesDialog.tsx
git commit -m "feat(fast-media): dialog adicionar cliente à grade de stories"
```

---

## Task 5: Nome vira link + editar/remover no StoriesMonthGrid

**Files:**
- Modify: `src/components/fast-media/StoriesMonthGrid.tsx`

- [ ] **Step 1: Atualizar os imports do topo**

Substitua o bloco de imports atual de `src/components/fast-media/StoriesMonthGrid.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Minus, Plus, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { setStoryDayCountAction } from "@/lib/painel/stories-actions";
import type { StoriesGridRow } from "@/lib/painel/stories-queries";
import { cn } from "@/lib/utils";
```

por:

```tsx
"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Minus, Plus, Check, Pencil, Trash2, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  setStoryDayCountAction,
  updateClienteDiariaStoriesAction,
  removeClienteStoriesAction,
} from "@/lib/painel/stories-actions";
import type { StoriesGridRow } from "@/lib/painel/stories-queries";
import { cn } from "@/lib/utils";
```

- [ ] **Step 2: Adicionar estado e handlers dentro de `ClientStoryRow`**

Em `ClientStoryRow`, logo depois da linha `const [pending, startTransition] = useTransition();`, adicione:

```tsx
  const router = useRouter();
  const [managing, setManaging] = useState(false);
  const [diariaInput, setDiariaInput] = useState<string>(String(row.quantidade_diaria_stories));
  const [confirmRemove, setConfirmRemove] = useState(false);

  function saveDiaria() {
    const n = Number(diariaInput);
    if (!Number.isInteger(n) || n < 1 || n > 99) {
      toast.error("Quantidade diária deve ser de 1 a 99");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("client_id", row.client_id);
      fd.set("quantidade_diaria", String(n));
      const res = await updateClienteDiariaStoriesAction(fd);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Quantidade diária atualizada");
      setManaging(false);
      router.refresh();
    });
  }

  function removeFromGrid() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("client_id", row.client_id);
      const res = await removeClienteStoriesAction(fd);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Cliente removido da grade");
      setManaging(false);
      setConfirmRemove(false);
      router.refresh();
    });
  }
```

- [ ] **Step 3: Trocar o nome por um link + botão de gerenciar**

Substitua este bloco (o cabeçalho do card):

```tsx
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{row.client_nome}</p>
          <p className="text-xs text-muted-foreground">
            {row.quantidade_diaria_stories}/dia
            {row.assessor_nome ? ` · ${row.assessor_nome}` : ""}
          </p>
        </div>
        <p className="text-sm font-bold tabular-nums">
          {totalPostados}
          <span className="text-xs font-medium text-muted-foreground"> / {row.meta}</span>
          <span className="ml-1.5 text-xs font-medium text-primary">{Math.round(pct)}%</span>
        </p>
      </div>
```

por:

```tsx
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/clientes/${row.client_id}`}
            className="group inline-flex items-center gap-1 truncate text-sm font-semibold hover:underline"
          >
            <span className="truncate">{row.client_nome}</span>
            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
          <p className="text-xs text-muted-foreground">
            {row.quantidade_diaria_stories}/dia
            {row.assessor_nome ? ` · ${row.assessor_nome}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold tabular-nums">
            {totalPostados}
            <span className="text-xs font-medium text-muted-foreground"> / {row.meta}</span>
            <span className="ml-1.5 text-xs font-medium text-primary">{Math.round(pct)}%</span>
          </p>
          {canEdit && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => {
                setDiariaInput(String(row.quantidade_diaria_stories));
                setConfirmRemove(false);
                setManaging(true);
              }}
              aria-label="Gerenciar cliente"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
```

- [ ] **Step 4: Adicionar o dialog de gerenciar antes do fechamento do componente**

Logo antes do `</div>` final de `ClientStoryRow` (depois do `</Dialog>` do contador de dia), adicione:

```tsx
      {/* Gerenciar cliente: editar diária / remover da grade */}
      <Dialog
        open={managing}
        onOpenChange={(o) => {
          if (!o) {
            setManaging(false);
            setConfirmRemove(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>{row.client_nome}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor={`diaria-${row.client_id}`}>Stories por dia</Label>
              <Input
                id={`diaria-${row.client_id}`}
                type="number"
                min={1}
                max={99}
                step={1}
                value={diariaInput}
                onChange={(e) => setDiariaInput(e.target.value)}
                disabled={pending}
              />
            </div>

            {confirmRemove ? (
              <div className="space-y-2 rounded-md border border-rose-500/30 bg-rose-500/5 p-3">
                <p className="text-xs text-muted-foreground">
                  Remove o cliente da grade de stories. O histórico de marcações é
                  mantido — se readicionar depois, os stories já marcados reaparecem.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={pending}
                    onClick={removeFromGrid}
                  >
                    {pending ? "Removendo..." : "Confirmar remoção"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => setConfirmRemove(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-rose-600 hover:text-rose-700 dark:text-rose-400"
                disabled={pending}
                onClick={() => setConfirmRemove(true)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Remover da grade
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setManaging(false)}>
              Fechar
            </Button>
            <Button type="button" disabled={pending} onClick={saveDiaria}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 5: Type-check + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/fast-media/StoriesMonthGrid.tsx
git commit -m "feat(fast-media): nome linkado à ficha + editar/remover cliente na grade"
```

---

## Task 6: Ligar tudo na página /fast-media

**Files:**
- Modify: `src/app/(authed)/fast-media/page.tsx`

- [ ] **Step 1: Adicionar imports**

No topo de `src/app/(authed)/fast-media/page.tsx`, adicione junto aos imports existentes:

```tsx
import { getStoriesGridForMonth, getClientesElegiveisStories } from "@/lib/painel/stories-queries";
import { AdicionarClienteStoriesDialog } from "@/components/fast-media/AdicionarClienteStoriesDialog";
```

Obs: substitua a linha de import existente `import { getStoriesGridForMonth } from "@/lib/painel/stories-queries";` pela versão acima (com as duas funções). O import do `AdicionarClienteStoriesDialog` é linha nova.

- [ ] **Step 2: Carregar os elegíveis no data fetch**

Substitua:

```tsx
  const unitClientIds = await getClientIdsForActiveUnit();
  const [storiesRows, demandas] = await Promise.all([
    getStoriesGridForMonth(mesRef, unitClientIds),
    getFastMidiaDemandas(user.id, user.role),
  ]);
```

por:

```tsx
  const unitClientIds = await getClientIdsForActiveUnit();
  const [storiesRows, demandas, clientesElegiveis] = await Promise.all([
    getStoriesGridForMonth(mesRef, unitClientIds),
    getFastMidiaDemandas(user.id, user.role),
    canEdit ? getClientesElegiveisStories(unitClientIds) : Promise.resolve([]),
  ]);
```

- [ ] **Step 3: Renderizar o botão no cabeçalho da seção Stories**

No cabeçalho da seção Stories, substitua o container do seletor de mês:

```tsx
          <div className="flex items-center gap-1 rounded-lg border bg-card p-0.5">
            <Link
              href={`/fast-media?mes=${shiftMonth(mesRef, -1)}`}
              className="rounded-md p-1 hover:bg-muted"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <span className="min-w-[7.5rem] text-center text-sm font-medium capitalize">{monthLabel(mesRef)}</span>
            <Link
              href={`/fast-media?mes=${shiftMonth(mesRef, 1)}`}
              className="rounded-md p-1 hover:bg-muted"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
```

por:

```tsx
          <div className="flex items-center gap-2">
            {canEdit && <AdicionarClienteStoriesDialog clientesElegiveis={clientesElegiveis} />}
            <div className="flex items-center gap-1 rounded-lg border bg-card p-0.5">
              <Link
                href={`/fast-media?mes=${shiftMonth(mesRef, -1)}`}
                className="rounded-md p-1 hover:bg-muted"
                aria-label="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
              <span className="min-w-[7.5rem] text-center text-sm font-medium capitalize">{monthLabel(mesRef)}</span>
              <Link
                href={`/fast-media?mes=${shiftMonth(mesRef, 1)}`}
                className="rounded-md p-1 hover:bg-muted"
                aria-label="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
```

- [ ] **Step 4: Type-check + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(authed)/fast-media/page.tsx"
git commit -m "feat(fast-media): botão adicionar cliente na seção de stories"
```

---

## Task 7: Verificação final e PR

- [ ] **Step 1: Rodar a suíte completa de verificação**

Run: `npm run typecheck && npm run lint && npx vitest run tests/unit/stories-manage-actions.test.ts`
Expected: tudo PASS.

- [ ] **Step 2: Push e abrir PR**

```bash
git push -u origin feat/fast-media-gerenciar-stories
gh pr create --title "feat(fast-media): gerenciar clientes de stories pelo menu" --body "$(cat <<'EOF'
## O que faz
No /fast-media, permite:
- **Adicionar cliente** à grade de stories (escolhe cliente da carteira + quantidade diária)
- **Editar** a quantidade diária e **remover** da grade (mantém histórico) por card
- **Nome do cliente vira link** pra ficha (/clientes/[id])

## Como funciona
- Reusa colunas existentes `clients.tem_stories` e `clients.quantidade_diaria_stories` — **sem migration**.
- Actions rodam via service-role (fast_midia não tem RLS de UPDATE em clients), protegidas por gate de role + validação de unidade.

## Testes
- `tests/unit/stories-manage-actions.test.ts` (gate de role, add/editar/remover, fora-da-unidade, quantidade inválida).
- typecheck + lint verdes.

Spec: docs/superpowers/specs/2026-07-15-fast-media-gerenciar-clientes-stories-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Esperar CI verde e mergear**

Após o CI (`ci.yml`) ficar verde:

```bash
gh pr merge --squash --delete-branch
```

Nota: **sem migration manual** — nada a rodar no Supabase após o merge.

---

## Self-Review

**Spec coverage:**
- Adicionar cliente + quantidade → Task 2 (action) + Task 4 (dialog) + Task 6 (wire). ✓
- Editar quantidade → Task 2 + Task 5. ✓
- Remover da grade (mantém histórico) → Task 2 + Task 5. ✓
- Nome vira link pra ficha → Task 5. ✓
- Query de elegíveis → Task 1. ✓
- Service-role + gate de role + validação de unidade → Task 2. ✓
- Sem migration → confirmado (só UPDATE em colunas existentes). ✓
- Testes → Task 3. ✓

**Placeholder scan:** nenhum TBD/TODO; todo passo com código completo. ✓

**Type consistency:** `ClienteElegivelStories` (Task 1) é usado em Task 4/6; `addClienteStoriesAction` / `updateClienteDiariaStoriesAction` / `removeClienteStoriesAction` (Task 2) usados em Task 3/4/5 com as mesmas assinaturas (`FormData` → `{ error?, success? }`). `ALLOWED_ROLES` e `uuidLike` reusados do topo do arquivo. ✓
