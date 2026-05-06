# Dashboards Executores (videomaker, designer, editor) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o `StubGreeting` para os roles `videomaker`, `designer` e `editor` por dashboards próprios; adicionar campo `artes_entregues` em `tasks` com modal obrigatório para designer ao concluir tarefa.

**Architecture:** 3 Server Components de dashboard que reutilizam 3 widgets compartilhados (`FixoCard`, `MinhasTarefasPendentes`, `PeriodoSelector`). Queries server-only em novo módulo `src/lib/dashboard/personal.ts` cacheadas com `unstable_cache` + tag `dashboard`. Modal de "Quantas artes" implementado com componente `<CompleteTaskButton>` client-side que envolve a `toggleTaskCompletionAction` estendida — abre `<ArtesPromptModal>` quando role é designer e está concluindo.

**Tech Stack:** Next.js 16 (App Router, Server Components), React 19, Supabase (`@supabase/ssr`), Zod, Tailwind, Base UI Dialog, Vitest (unit), Playwright (E2E).

**Spec:** [docs/superpowers/specs/2026-05-05-dashboards-executores-design.md](../specs/2026-05-05-dashboards-executores-design.md)

---

## Mapa de arquivos

**Criar:**
- `supabase/migrations/20260505000042_tasks_artes_entregues.sql` — adiciona campo
- `src/lib/dashboard/personal.ts` — queries pessoais (4 funções)
- `src/components/dashboard/personal/FixoCard.tsx` — KPI card do fixo
- `src/components/dashboard/personal/MinhasTarefasPendentes.tsx` — lista
- `src/components/dashboard/personal/PeriodoSelector.tsx` — dropdown URL-driven (client)
- `src/components/dashboard/DashboardVideomaker.tsx`
- `src/components/dashboard/DashboardDesigner.tsx`
- `src/components/dashboard/DashboardEditor.tsx`
- `src/components/tarefas/ArtesPromptModal.tsx` — dialog de input numérico (client)
- `src/components/tarefas/CompleteTaskButton.tsx` — wrapper client que pluga modal (client)
- `tests/unit/tarefas-toggle-completion.test.ts` — testa as 3 ramificações da action
- `tests/unit/dashboard-personal.test.ts` — testa `resolvePeriodo` (puro)
- `tests/e2e/dashboard-designer.spec.ts` — fluxo E2E

**Modificar:**
- `src/lib/tarefas/actions.ts` — estende `toggleTaskCompletionAction(taskId, artesEntregues?)`
- `src/lib/tarefas/schema.ts` — adiciona schema Zod pro arg
- `src/components/tarefas/TaskCard.tsx` — substitui `handleQuickComplete` direto por uso de `<CompleteTaskButton>`
- `src/app/(authed)/tarefas/[id]/page.tsx` — substitui form server-action por `<CompleteTaskButton>`
- `src/app/(authed)/page.tsx` — adiciona 3 branches de routing

---

## Task 1: Migration — campo `artes_entregues` em `tasks`

**Files:**
- Create: `supabase/migrations/20260505000042_tasks_artes_entregues.sql`

- [ ] **Step 1: Criar migration**

```sql
-- supabase/migrations/20260505000042_tasks_artes_entregues.sql
-- Campo opcional preenchido pelo designer ao concluir uma tarefa.
-- Nullable por design: tarefas concluídas por outros roles ou tarefas
-- antigas (anteriores a esta migration) ficam null.

alter table public.tasks
  add column if not exists artes_entregues integer null
  check (artes_entregues is null or artes_entregues >= 0);
```

- [ ] **Step 2: Aplicar migration localmente (ou anotar pra rodar pós-merge)**

Esta repo aplica migrations manualmente (não via CI — checado em [.github/workflows/ci.yml](.github/workflows/ci.yml)). Pra teste local, rode:

```bash
npm run db:push
```

Ou aplique via SQL Editor do Supabase pós-merge.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260505000042_tasks_artes_entregues.sql
git commit -m "feat(tasks): adiciona campo artes_entregues nullable"
```

---

## Task 2: Estender schema Zod da action

**Files:**
- Modify: `src/lib/tarefas/schema.ts`

- [ ] **Step 1: Ler arquivo atual e identificar onde plugar**

```bash
head -30 src/lib/tarefas/schema.ts
```

- [ ] **Step 2: Adicionar schema do arg `artesEntregues`**

Adicionar ao final do arquivo `src/lib/tarefas/schema.ts`:

```ts
import { z } from "zod";

// (já tem outros exports — adicionar este)
export const artesEntreguesSchema = z
  .number({ invalid_type_error: "Quantidade inválida" })
  .int("Use número inteiro")
  .min(0, "Não pode ser negativo");
```

(Se o `import { z }` já existir no topo, não duplicar.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/tarefas/schema.ts
git commit -m "feat(tarefas): adiciona artesEntreguesSchema (int >= 0)"
```

---

## Task 3: Estender `toggleTaskCompletionAction` — testes primeiro

**Files:**
- Test: `tests/unit/tarefas-toggle-completion.test.ts`

- [ ] **Step 1: Escrever teste de cada ramificação**

Criar `tests/unit/tarefas-toggle-completion.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const fromCookieMock = vi.hoisted(() => vi.fn());
const requireAuthMock = vi.hoisted(() => vi.fn());
const logAuditMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromCookieMock }),
}));

vi.mock("@/lib/auth/session", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/lib/audit/log", () => ({
  logAudit: logAuditMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { toggleTaskCompletionAction } from "@/lib/tarefas/actions";

beforeEach(() => {
  fromCookieMock.mockReset();
  requireAuthMock.mockReset();
  logAuditMock.mockReset();
});

function mockTaskRow(overrides: Partial<{ status: string; criado_por: string; atribuido_a: string; completed_at: string | null; artes_entregues: number | null }>) {
  return {
    id: "task-1",
    status: "aberta",
    criado_por: "user-1",
    atribuido_a: "user-1",
    completed_at: null,
    artes_entregues: null,
    ...overrides,
  };
}

function mockSelect(returnData: unknown) {
  const single = vi.fn().mockResolvedValue({ data: returnData });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  fromCookieMock.mockImplementation((table: string) => {
    if (table === "tasks") {
      return {
        select,
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      };
    }
    return {};
  });
  return { single, eq, select };
}

describe("toggleTaskCompletionAction — designer flow", () => {
  it("designer fechando sem artesEntregues retorna requiresArtesPrompt sem mutar", async () => {
    requireAuthMock.mockResolvedValue({ id: "user-1", role: "designer" });
    mockSelect(mockTaskRow({ status: "aberta" }));

    const result = await toggleTaskCompletionAction("task-1");

    expect(result).toEqual({ requiresArtesPrompt: true });
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("designer fechando com artesEntregues=5 grava status=concluida e artes_entregues=5", async () => {
    requireAuthMock.mockResolvedValue({ id: "user-1", role: "designer" });
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq: updateEq });
    fromCookieMock.mockImplementation((table: string) => {
      if (table === "tasks") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockTaskRow({ status: "aberta" }) }),
            }),
          }),
          update,
        };
      }
      return {};
    });

    const result = await toggleTaskCompletionAction("task-1", 5);

    expect(result).toBeUndefined();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: "concluida",
      artes_entregues: 5,
    }));
  });

  it("designer fechando com artesEntregues=0 também grava (0 é válido)", async () => {
    requireAuthMock.mockResolvedValue({ id: "user-1", role: "designer" });
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    fromCookieMock.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockTaskRow({ status: "aberta" }) }),
        }),
      }),
      update,
    }));

    const result = await toggleTaskCompletionAction("task-1", 0);

    expect(result).toBeUndefined();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: "concluida",
      artes_entregues: 0,
    }));
  });

  it("designer com artesEntregues negativo retorna erro", async () => {
    requireAuthMock.mockResolvedValue({ id: "user-1", role: "designer" });
    mockSelect(mockTaskRow({ status: "aberta" }));

    const result = await toggleTaskCompletionAction("task-1", -1);

    expect(result?.error).toBeTruthy();
  });

  it("designer reabrindo (concluida → aberta) NÃO pede prompt e mantém artes_entregues", async () => {
    requireAuthMock.mockResolvedValue({ id: "user-1", role: "designer" });
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    fromCookieMock.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockTaskRow({ status: "concluida", artes_entregues: 3 }) }),
        }),
      }),
      update,
    }));

    const result = await toggleTaskCompletionAction("task-1");

    expect(result).toBeUndefined();
    const updateArg = update.mock.calls[0][0];
    expect(updateArg.status).toBe("aberta");
    expect(updateArg).not.toHaveProperty("artes_entregues"); // não envia, mantém
  });
});

describe("toggleTaskCompletionAction — outros roles", () => {
  it("assessor fechando NÃO pede prompt e grava sem artes_entregues", async () => {
    requireAuthMock.mockResolvedValue({ id: "user-1", role: "assessor" });
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    fromCookieMock.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockTaskRow({ status: "aberta" }) }),
        }),
      }),
      update,
    }));

    const result = await toggleTaskCompletionAction("task-1");

    expect(result).toBeUndefined();
    const updateArg = update.mock.calls[0][0];
    expect(updateArg.status).toBe("concluida");
    expect(updateArg).not.toHaveProperty("artes_entregues");
  });
});
```

- [ ] **Step 2: Rodar teste — deve falhar**

Rode (do diretório principal, que tem node_modules):
```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento" && npx vitest run tests/unit/tarefas-toggle-completion.test.ts
```

Esperado: vários testes falham porque a action ainda não aceita o segundo argumento e não tem a lógica de prompt.

- [ ] **Step 3: Commit dos testes (red)**

```bash
git add tests/unit/tarefas-toggle-completion.test.ts
git commit -m "test(tarefas): cobre fluxo designer/outros para toggleTaskCompletion"
```

---

## Task 4: Implementar a extensão da action

**Files:**
- Modify: `src/lib/tarefas/actions.ts`

- [ ] **Step 1: Adicionar import do schema (se não tiver) no topo do arquivo**

```ts
import { createTaskSchema, editTaskSchema, moveStatusSchema, artesEntreguesSchema } from "./schema";
```

- [ ] **Step 2: Substituir a função `toggleTaskCompletionAction` inteira (linha ~232 até o `return { success: ... }`)**

Substituir pelo corpo completo abaixo (mantém todas as chamadas existentes — dispatchNotification, revalidatePath, return success):

```ts
export async function toggleTaskCompletionAction(
  taskId: string,
  artesEntregues?: number,
) {
  const actor = await requireAuth();
  const supabase = await createClient();
  const { data: t } = await supabase.from("tasks").select("*").eq("id", taskId).single();
  if (!t) return { error: "Tarefa não encontrada" };

  const canToggle =
    t.criado_por === actor.id ||
    t.atribuido_a === actor.id ||
    isPrivileged(actor);
  if (!canToggle) return { error: "Sem permissão" };

  const novoStatus = t.status === "concluida" ? "aberta" : "concluida";
  const isClosing = novoStatus === "concluida";

  // Designer fechando sem ter informado quantas artes → pede prompt
  if (isClosing && actor.role === "designer" && artesEntregues === undefined) {
    return { requiresArtesPrompt: true };
  }

  // Valida artesEntregues quando enviado (apenas designer + fechando)
  let artesValor: number | null = null;
  if (isClosing && actor.role === "designer" && artesEntregues !== undefined) {
    const parsed = artesEntreguesSchema.safeParse(artesEntregues);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    artesValor = parsed.data;
  }

  const completed_at = isClosing ? new Date().toISOString() : null;

  // Payload: só inclui artes_entregues quando designer está fechando.
  // Reabrir ou outros roles → não toca no campo.
  const updatePayload: Record<string, unknown> = { status: novoStatus, completed_at };
  if (isClosing && actor.role === "designer") {
    updatePayload.artes_entregues = artesValor;
  }

  const { error } = await supabase
    .from("tasks")
    .update(updatePayload)
    .eq("id", taskId);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "tasks",
    entidade_id: taskId,
    acao: novoStatus === "concluida" ? "complete" : "reopen",
    dados_antes: {
      status: t.status,
      completed_at: t.completed_at,
      artes_entregues: t.artes_entregues,
    } as Record<string, unknown>,
    dados_depois: updatePayload,
    ator_id: actor.id,
  });

  if (novoStatus === "concluida") {
    await dispatchNotification({
      evento_tipo: "task_completed",
      titulo: "Tarefa concluída",
      mensagem: `${actor.nome} concluiu: "${t.titulo}"`,
      link: `/tarefas/${taskId}`,
      user_ids_extras: [t.criado_por],
      source_user_id: actor.id,
    });
  }

  revalidatePath("/tarefas");
  revalidatePath(`/tarefas/${taskId}`);
  if (t.client_id) revalidatePath(`/clientes/${t.client_id}/tarefas`);
  return { success: novoStatus === "concluida" ? "Tarefa concluída" : "Tarefa reaberta" };
}
```

- [ ] **Step 3: Rodar testes — devem passar**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento" && npx vitest run tests/unit/tarefas-toggle-completion.test.ts
```

Esperado: todos os testes passam.

- [ ] **Step 4: Rodar typecheck**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/loving-heyrovsky-89b69e" && ln -sf "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/node_modules" node_modules && npx tsc --noEmit
```

Exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tarefas/actions.ts
git commit -m "feat(tarefas): toggleTaskCompletion aceita artesEntregues e prompta designer"
```

---

## Task 5: Modal `ArtesPromptModal`

**Files:**
- Create: `src/components/tarefas/ArtesPromptModal.tsx`

- [ ] **Step 1: Criar componente**

```tsx
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (artesEntregues: number) => void | Promise<void>;
  pending?: boolean;
}

export function ArtesPromptModal({ open, onOpenChange, onConfirm, pending }: Props) {
  const [valor, setValor] = useState<string>("");
  const [erro, setErro] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const n = Number(valor);
    if (!Number.isInteger(n) || n < 0) {
      setErro("Use um número inteiro maior ou igual a 0");
      return;
    }
    void onConfirm(n);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quantas artes foram entregues?</DialogTitle>
          <DialogDescription>
            Informe quantas artes você produziu nessa tarefa. Se não foi de arte, coloque 0.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="artes_entregues">Quantidade</Label>
            <Input
              id="artes_entregues"
              type="number"
              min={0}
              step={1}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              autoFocus
              required
            />
            {erro && <p className="text-sm text-destructive">{erro}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Concluir tarefa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Atenção:** verificar se `DialogContent`, `DialogHeader`, etc. são exports reais de `@/components/ui/dialog`. Se a API local for diferente (ex: `Dialog.Content`), adaptar mantendo a mesma estrutura visual.

- [ ] **Step 2: Typecheck**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/loving-heyrovsky-89b69e" && npx tsc --noEmit
```

Exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/tarefas/ArtesPromptModal.tsx
git commit -m "feat(tarefas): modal ArtesPromptModal pra capturar quantas artes"
```

---

## Task 6: Wrapper `CompleteTaskButton`

**Files:**
- Create: `src/components/tarefas/CompleteTaskButton.tsx`

- [ ] **Step 1: Criar componente client que usa a action e o modal**

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toggleTaskCompletionAction } from "@/lib/tarefas/actions";
import { ArtesPromptModal } from "./ArtesPromptModal";

interface Props {
  taskId: string;
  isCompleted: boolean;
  userRole: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  /** Quando passado, sobrescreve o label do botão. */
  label?: string;
}

export function CompleteTaskButton({
  taskId, isCompleted, userRole, variant, size, className, label,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const computedLabel = label ?? (isCompleted ? "Reabrir" : "Marcar como concluída");
  const computedVariant = variant ?? (isCompleted ? "outline" : "default");

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setErro(null);

    startTransition(async () => {
      const result = await toggleTaskCompletionAction(taskId);
      if (result?.requiresArtesPrompt) {
        setModalOpen(true);
        return;
      }
      if (result?.error) {
        setErro(result.error);
      }
    });
  }

  function handleConfirmArtes(artes: number) {
    startTransition(async () => {
      const result = await toggleTaskCompletionAction(taskId, artes);
      if (result?.error) {
        setErro(result.error);
        return;
      }
      setModalOpen(false);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={computedVariant}
        size={size}
        className={className}
        disabled={pending}
        onClick={handleClick}
      >
        {pending ? "Salvando..." : computedLabel}
      </Button>
      {erro && <p className="mt-1 text-xs text-destructive">{erro}</p>}
      <ArtesPromptModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onConfirm={handleConfirmArtes}
        pending={pending}
      />
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/tarefas/CompleteTaskButton.tsx
git commit -m "feat(tarefas): CompleteTaskButton agrupa toggle + modal de artes"
```

---

## Task 7: Substituir uso direto em `TaskCard`

**Files:**
- Modify: `src/components/tarefas/TaskCard.tsx`

- [ ] **Step 1: Localizar `handleQuickComplete` e o botão que o chama**

```bash
grep -n "handleQuickComplete\|toggleTaskCompletion" src/components/tarefas/TaskCard.tsx
```

- [ ] **Step 2: Adicionar prop `userRole` ao componente**

Em `src/components/tarefas/TaskCard.tsx`, adicionar `userRole: string` à interface Props:

```ts
// Antes:
interface Props {
  task: TaskRow;
  // ...outras
}

// Depois:
interface Props {
  task: TaskRow;
  userRole: string;  // NOVO
  // ...outras
}
```

- [ ] **Step 3: Substituir `handleQuickComplete` e o botão**

Remover a função `handleQuickComplete` e o `import { toggleTaskCompletionAction }`. Substituir o botão de "Concluir" pelo `<CompleteTaskButton>`:

```tsx
import { CompleteTaskButton } from "./CompleteTaskButton";

// onde estava o botão de quick complete, trocar por:
<CompleteTaskButton
  taskId={task.id}
  isCompleted={task.status === "concluida"}
  userRole={userRole}
  size="sm"
  variant="ghost"
  label={task.status === "concluida" ? "↩" : "✓"}
/>
```

(Preservar o estilo visual original — labels e tamanhos podem precisar ajuste pra caber no card.)

- [ ] **Step 4: Atualizar todos os call sites de `<TaskCard>` pra passarem `userRole`**

```bash
grep -rn "<TaskCard" src --include="*.tsx" 2>&1
```

Em cada call site, adicionar `userRole={user.role}` (puxar de `requireAuth` ou prop drilling).

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```

Exit 0. Resolver erros de prop faltando se aparecer.

- [ ] **Step 6: Commit**

```bash
git add src/components/tarefas/TaskCard.tsx src
git commit -m "refactor(tarefas): TaskCard usa CompleteTaskButton ao invés de chamar action direto"
```

---

## Task 8: Substituir uso em `tarefas/[id]/page.tsx`

**Files:**
- Modify: `src/app/(authed)/tarefas/[id]/page.tsx`

- [ ] **Step 1: Substituir `<form action={toggle}>` por `<CompleteTaskButton>`**

Localizar o bloco em [src/app/(authed)/tarefas/[id]/page.tsx:33-45](src/app/(authed)/tarefas/[id]/page.tsx). Remover:

```tsx
async function toggle() {
  "use server";
  await toggleTaskCompletionAction(id);
}
// ...
{canEdit && (
  <form action={toggle}>
    <Button type="submit" variant={task.status === "concluida" ? "outline" : "default"}>
      {task.status === "concluida" ? "Reabrir" : "Marcar como concluída"}
    </Button>
  </form>
)}
```

Substituir por:

```tsx
import { CompleteTaskButton } from "@/components/tarefas/CompleteTaskButton";

// no JSX:
{canEdit && (
  <CompleteTaskButton
    taskId={id}
    isCompleted={task.status === "concluida"}
    userRole={user.role}
  />
)}
```

Remover o import `toggleTaskCompletionAction` se não for usado em mais nada.

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(authed\)/tarefas/\[id\]/page.tsx
git commit -m "refactor(tarefas): página de detalhe usa CompleteTaskButton"
```

---

## Task 9: Queries pessoais — `resolvePeriodo` (puro, com testes)

**Files:**
- Test: `tests/unit/dashboard-personal.test.ts`
- Create: `src/lib/dashboard/personal.ts`

- [ ] **Step 1: Escrever testes da função pura**

```ts
// tests/unit/dashboard-personal.test.ts
import { describe, it, expect } from "vitest";
import { resolvePeriodo } from "@/lib/dashboard/personal";

describe("resolvePeriodo", () => {
  it("'mes_atual' retorna início e fim do mês corrente em UTC ISO", () => {
    const ref = new Date("2026-05-15T10:00:00Z");
    const r = resolvePeriodo("mes_atual", ref);
    expect(r.fromIso.startsWith("2026-05-01")).toBe(true);
    expect(r.toIso.startsWith("2026-06-01")).toBe(true);
  });

  it("'mes_anterior' retorna mês passado fechado", () => {
    const ref = new Date("2026-05-15T10:00:00Z");
    const r = resolvePeriodo("mes_anterior", ref);
    expect(r.fromIso.startsWith("2026-04-01")).toBe(true);
    expect(r.toIso.startsWith("2026-05-01")).toBe(true);
  });

  it("'dias_7' retorna últimos 7 dias rolling", () => {
    const ref = new Date("2026-05-15T10:00:00Z");
    const r = resolvePeriodo("dias_7", ref);
    expect(r.fromIso.startsWith("2026-05-08")).toBe(true);
    expect(r.toIso.startsWith("2026-05-15")).toBe(true);
  });

  it("'total' retorna janela aberta (from no épico, to no futuro)", () => {
    const ref = new Date("2026-05-15T10:00:00Z");
    const r = resolvePeriodo("total", ref);
    expect(new Date(r.fromIso).getFullYear()).toBeLessThanOrEqual(2000);
    expect(new Date(r.toIso).getFullYear()).toBeGreaterThanOrEqual(2100);
  });

  it("valor desconhecido cai em 'mes_atual'", () => {
    const ref = new Date("2026-05-15T10:00:00Z");
    const r = resolvePeriodo("xyz" as never, ref);
    expect(r.fromIso.startsWith("2026-05-01")).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar — deve falhar (módulo não existe)**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento" && npx vitest run tests/unit/dashboard-personal.test.ts
```

Esperado: erro "cannot find module".

- [ ] **Step 3: Criar `src/lib/dashboard/personal.ts` com `resolvePeriodo` mínimo**

```ts
// SERVER ONLY: do not import from client components
export type Periodo = "mes_atual" | "mes_anterior" | "dias_7" | "total";

export function resolvePeriodo(periodo: Periodo, reference: Date = new Date()): {
  fromIso: string;
  toIso: string;
} {
  const ref = new Date(reference);
  if (periodo === "mes_anterior") {
    const from = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - 1, 1));
    const to = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
    return { fromIso: from.toISOString(), toIso: to.toISOString() };
  }
  if (periodo === "dias_7") {
    const from = new Date(ref.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { fromIso: from.toISOString(), toIso: ref.toISOString() };
  }
  if (periodo === "total") {
    return { fromIso: "1970-01-01T00:00:00.000Z", toIso: "2999-12-31T23:59:59.999Z" };
  }
  // default: mes_atual
  const from = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
  const to = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1));
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}
```

- [ ] **Step 4: Rodar testes — devem passar**

```bash
npx vitest run tests/unit/dashboard-personal.test.ts
```

Exit 0.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/dashboard-personal.test.ts src/lib/dashboard/personal.ts
git commit -m "feat(dashboard): resolvePeriodo (mes_atual|mes_anterior|dias_7|total)"
```

---

## Task 10: Queries pessoais — restantes

**Files:**
- Modify: `src/lib/dashboard/personal.ts`

- [ ] **Step 1: Adicionar `getMinhasTarefasPendentes`**

Adicionar ao final de `src/lib/dashboard/personal.ts`:

```ts
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface TarefaPendenteRow {
  id: string;
  titulo: string;
  prioridade: string | null;
  due_date: string | null;
  status: string;
  cliente_nome: string | null;
}

export async function _getMinhasTarefasPendentesImpl(userId: string): Promise<TarefaPendenteRow[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("tasks")
    .select(`
      id, titulo, prioridade, due_date, status,
      cliente:clients(nome)
    `)
    .neq("status", "concluida")
    .or(`atribuido_a.eq.${userId},participantes_ids.cs.{${userId}}`)
    .order("due_date", { ascending: true, nullsFirst: false });

  return ((data ?? []) as Array<{
    id: string;
    titulo: string;
    prioridade: string | null;
    due_date: string | null;
    status: string;
    cliente: { nome: string } | null;
  }>).map((r) => ({
    id: r.id,
    titulo: r.titulo,
    prioridade: r.prioridade,
    due_date: r.due_date,
    status: r.status,
    cliente_nome: r.cliente?.nome ?? null,
  }));
}

export async function getMinhasTarefasPendentes(userId: string): Promise<TarefaPendenteRow[]> {
  const cached = unstable_cache(
    async (uid: string) => _getMinhasTarefasPendentesImpl(uid),
    ["dashboard-personal-tarefas-pendentes"],
    { revalidate: 60, tags: ["dashboard", "tasks"] },
  );
  return cached(userId);
}
```

- [ ] **Step 2: Adicionar `getProximasGravacoes`**

```ts
export interface GravacaoRow {
  id: string;
  titulo: string;
  inicio: string;
  fim: string;
  localizacao_endereco: string | null;
}

export async function _getProximasGravacoesImpl(
  userId: string,
  fromIso: string,
  toIso: string,
): Promise<GravacaoRow[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("calendar_events")
    .select("id, titulo, inicio, fim, localizacao_endereco")
    .eq("sub_calendar", "videomakers")
    .contains("participantes_ids", [userId])
    .gte("inicio", fromIso)
    .lte("inicio", toIso)
    .order("inicio", { ascending: true });

  return (data ?? []) as GravacaoRow[];
}

export async function getProximasGravacoes(
  userId: string,
  fromIso: string,
  toIso: string,
): Promise<GravacaoRow[]> {
  const cached = unstable_cache(
    async (paramsJson: string) => {
      const { uid, from, to } = JSON.parse(paramsJson) as { uid: string; from: string; to: string };
      return _getProximasGravacoesImpl(uid, from, to);
    },
    ["dashboard-personal-gravacoes"],
    { revalidate: 60, tags: ["dashboard", "calendar"] },
  );
  return cached(JSON.stringify({ uid: userId, from: fromIso, to: toIso }));
}
```

- [ ] **Step 3: Adicionar `getProducaoNoPeriodo`**

```ts
export async function _getProducaoNoPeriodoImpl(
  userId: string,
  fromIso: string,
  toIso: string,
  kind: "artes" | "tarefas",
): Promise<number> {
  const supabase = createServiceRoleClient();

  if (kind === "artes") {
    const { data } = await supabase
      .from("tasks")
      .select("artes_entregues")
      .eq("atribuido_a", userId)
      .eq("status", "concluida")
      .gte("completed_at", fromIso)
      .lt("completed_at", toIso);
    return ((data ?? []) as Array<{ artes_entregues: number | null }>)
      .reduce((acc, r) => acc + (r.artes_entregues ?? 0), 0);
  }

  // kind === "tarefas"
  const { count } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("atribuido_a", userId)
    .eq("status", "concluida")
    .gte("completed_at", fromIso)
    .lt("completed_at", toIso);
  return count ?? 0;
}

export async function getProducaoNoPeriodo(
  userId: string,
  fromIso: string,
  toIso: string,
  kind: "artes" | "tarefas",
): Promise<number> {
  const cached = unstable_cache(
    async (paramsJson: string) => {
      const { uid, from, to, k } = JSON.parse(paramsJson) as {
        uid: string; from: string; to: string; k: "artes" | "tarefas";
      };
      return _getProducaoNoPeriodoImpl(uid, from, to, k);
    },
    ["dashboard-personal-producao"],
    { revalidate: 60, tags: ["dashboard", "tasks"] },
  );
  return cached(JSON.stringify({ uid: userId, from: fromIso, to: toIso, k: kind }));
}
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboard/personal.ts
git commit -m "feat(dashboard): queries pessoais (tarefas pendentes, gravacoes, producao)"
```

---

## Task 11: Widget `FixoCard`

**Files:**
- Create: `src/components/dashboard/personal/FixoCard.tsx`

- [ ] **Step 1: Criar componente**

```tsx
import { createServiceRoleClient } from "@/lib/supabase/service-role";

interface Props {
  userId: string;
}

function formatBRL(n: number): string {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function getFixoMensal(userId: string): Promise<number> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("profiles")
    .select("fixo_mensal")
    .eq("id", userId)
    .single();
  return Number(data?.fixo_mensal ?? 0);
}

export async function FixoCard({ userId }: Props) {
  const valor = await getFixoMensal(userId);
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">Seu fixo mensal</p>
      <p className="mt-2 text-3xl font-bold tabular-nums">{formatBRL(valor)}</p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/personal/FixoCard.tsx
git commit -m "feat(dashboard): widget FixoCard"
```

---

## Task 12: Widget `MinhasTarefasPendentes`

**Files:**
- Create: `src/components/dashboard/personal/MinhasTarefasPendentes.tsx`

- [ ] **Step 1: Criar componente**

```tsx
import Link from "next/link";
import { getMinhasTarefasPendentes } from "@/lib/dashboard/personal";
import { cn } from "@/lib/utils";

interface Props {
  userId: string;
}

function formatDueDate(iso: string | null): string {
  if (!iso) return "Sem prazo";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function urgencyClass(due: string | null): string {
  if (!due) return "text-muted-foreground";
  const dueDate = new Date(due);
  const now = new Date();
  const diffDays = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "text-rose-600 dark:text-rose-400 font-semibold";
  if (diffDays < 2) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

export async function MinhasTarefasPendentes({ userId }: Props) {
  const tarefas = await getMinhasTarefasPendentes(userId);

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground/80">
        Tarefas pendentes
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          ({tarefas.length})
        </span>
      </h2>
      {tarefas.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhuma tarefa pendente. ✨
        </p>
      ) : (
        <ul className="space-y-2">
          {tarefas.map((t) => (
            <li key={t.id}>
              <Link
                href={`/tarefas/${t.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{t.titulo}</p>
                  {t.cliente_nome && (
                    <p className="truncate text-xs text-muted-foreground">{t.cliente_nome}</p>
                  )}
                </div>
                <span className={cn("text-xs tabular-nums", urgencyClass(t.due_date))}>
                  {formatDueDate(t.due_date)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/personal/MinhasTarefasPendentes.tsx
git commit -m "feat(dashboard): widget MinhasTarefasPendentes"
```

---

## Task 13: Widget `PeriodoSelector` (client)

**Files:**
- Create: `src/components/dashboard/personal/PeriodoSelector.tsx`

- [ ] **Step 1: Criar componente**

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";

const PERIODOS = [
  { value: "mes_atual", label: "Este mês" },
  { value: "mes_anterior", label: "Mês passado" },
  { value: "dias_7", label: "Últimos 7 dias" },
  { value: "total", label: "Tudo" },
] as const;

interface Props {
  current: string;
}

export function PeriodoSelector({ current }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "mes_atual") {
      params.delete("periodo");
    } else {
      params.set("periodo", value);
    }
    router.push(`?${params.toString()}`);
  }

  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border bg-card px-2 text-xs"
    >
      {PERIODOS.map((p) => (
        <option key={p.value} value={p.value}>{p.label}</option>
      ))}
    </select>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/personal/PeriodoSelector.tsx
git commit -m "feat(dashboard): widget PeriodoSelector URL-driven"
```

---

## Task 14: `DashboardVideomaker`

**Files:**
- Create: `src/components/dashboard/DashboardVideomaker.tsx`

- [ ] **Step 1: Criar componente**

```tsx
import Link from "next/link";
import { FixoCard } from "./personal/FixoCard";
import { getProximasGravacoes } from "@/lib/dashboard/personal";
import { Video, MapPin } from "lucide-react";

interface Props {
  userId: string;
  nome: string;
}

function getWeekRangeBR(): { fromIso: string; toIso: string } {
  // Início desta semana (segunda) até fim da próxima (domingo) em America/Sao_Paulo (-03)
  // Implementação simples: pega "agora" em UTC, ajusta -3h pra obter "agora" em BRT,
  // calcula segunda da semana, depois soma 14 dias pra fim.
  const now = new Date();
  const brtOffsetMs = 3 * 60 * 60 * 1000;
  const brtNow = new Date(now.getTime() - brtOffsetMs);
  const day = brtNow.getUTCDay(); // 0=domingo, 1=segunda
  const daysSinceMonday = (day + 6) % 7; // segunda=0, domingo=6
  const monday = new Date(brtNow);
  monday.setUTCDate(brtNow.getUTCDate() - daysSinceMonday);
  monday.setUTCHours(0, 0, 0, 0);
  const sundayNextWeek = new Date(monday);
  sundayNextWeek.setUTCDate(monday.getUTCDate() + 13);
  sundayNextWeek.setUTCHours(23, 59, 59, 999);
  // Reverter offset pra obter ISO em UTC real
  return {
    fromIso: new Date(monday.getTime() + brtOffsetMs).toISOString(),
    toIso: new Date(sundayNextWeek.getTime() + brtOffsetMs).toISOString(),
  };
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export async function DashboardVideomaker({ userId, nome }: Props) {
  const primeiroNome = nome.split(" ")[0];
  const { fromIso, toIso } = getWeekRangeBR();
  const gravacoes = await getProximasGravacoes(userId, fromIso, toIso);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Olá, {primeiroNome}</h1>
        <p className="text-sm text-muted-foreground">Suas próximas duas semanas de gravação.</p>
      </header>

      <FixoCard userId={userId} />

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground/80">
          <Video className="h-4 w-4" />
          Próximas gravações
          <span className="ml-1 text-xs font-normal text-muted-foreground">({gravacoes.length})</span>
        </h2>
        {gravacoes.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhuma gravação agendada nas próximas 2 semanas.
          </p>
        ) : (
          <ul className="space-y-2">
            {gravacoes.map((g) => (
              <li
                key={g.id}
                className="rounded-lg border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{g.titulo}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(g.inicio)}</p>
                    {g.localizacao_endereco && (
                      <p className="mt-1 flex items-start gap-1 text-xs">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                        <span>{g.localizacao_endereco}</span>
                      </p>
                    )}
                  </div>
                  <Link
                    href="/calendario"
                    className="text-xs text-primary hover:underline shrink-0"
                  >
                    Ver no calendário →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/DashboardVideomaker.tsx
git commit -m "feat(dashboard): DashboardVideomaker com fixo + próximas gravações"
```

---

## Task 15: `DashboardDesigner`

**Files:**
- Create: `src/components/dashboard/DashboardDesigner.tsx`

- [ ] **Step 1: Criar componente**

```tsx
import { FixoCard } from "./personal/FixoCard";
import { MinhasTarefasPendentes } from "./personal/MinhasTarefasPendentes";
import { PeriodoSelector } from "./personal/PeriodoSelector";
import { resolvePeriodo, getProducaoNoPeriodo, type Periodo } from "@/lib/dashboard/personal";
import { Palette } from "lucide-react";

interface Props {
  userId: string;
  nome: string;
  periodo?: Periodo;
}

const PERIODO_LABELS: Record<Periodo, string> = {
  mes_atual: "este mês",
  mes_anterior: "mês passado",
  dias_7: "últimos 7 dias",
  total: "no total",
};

export async function DashboardDesigner({ userId, nome, periodo = "mes_atual" }: Props) {
  const primeiroNome = nome.split(" ")[0];
  const { fromIso, toIso } = resolvePeriodo(periodo);
  const totalArtes = await getProducaoNoPeriodo(userId, fromIso, toIso, "artes");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Olá, {primeiroNome}</h1>
        <p className="text-sm text-muted-foreground">Sua produção e o que tem em aberto.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <FixoCard userId={userId} />
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Artes entregues ({PERIODO_LABELS[periodo]})
            </p>
            <PeriodoSelector current={periodo} />
          </div>
          <p className="mt-2 flex items-baseline gap-2 text-3xl font-bold tabular-nums">
            <Palette className="h-5 w-5 text-primary" />
            {totalArtes}
          </p>
        </div>
      </div>

      <MinhasTarefasPendentes userId={userId} />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/DashboardDesigner.tsx
git commit -m "feat(dashboard): DashboardDesigner com fixo + artes + tarefas"
```

---

## Task 16: `DashboardEditor`

**Files:**
- Create: `src/components/dashboard/DashboardEditor.tsx`

- [ ] **Step 1: Criar componente**

```tsx
import { FixoCard } from "./personal/FixoCard";
import { MinhasTarefasPendentes } from "./personal/MinhasTarefasPendentes";
import { PeriodoSelector } from "./personal/PeriodoSelector";
import { resolvePeriodo, getProducaoNoPeriodo, type Periodo } from "@/lib/dashboard/personal";
import { CheckCircle2 } from "lucide-react";

interface Props {
  userId: string;
  nome: string;
  periodo?: Periodo;
}

const PERIODO_LABELS: Record<Periodo, string> = {
  mes_atual: "este mês",
  mes_anterior: "mês passado",
  dias_7: "últimos 7 dias",
  total: "no total",
};

export async function DashboardEditor({ userId, nome, periodo = "mes_atual" }: Props) {
  const primeiroNome = nome.split(" ")[0];
  const { fromIso, toIso } = resolvePeriodo(periodo);
  const totalConcluidas = await getProducaoNoPeriodo(userId, fromIso, toIso, "tarefas");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Olá, {primeiroNome}</h1>
        <p className="text-sm text-muted-foreground">Sua produção e o que tem em aberto.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <FixoCard userId={userId} />
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Tarefas concluídas ({PERIODO_LABELS[periodo]})
            </p>
            <PeriodoSelector current={periodo} />
          </div>
          <p className="mt-2 flex items-baseline gap-2 text-3xl font-bold tabular-nums">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            {totalConcluidas}
          </p>
        </div>
      </div>

      <MinhasTarefasPendentes userId={userId} />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/DashboardEditor.tsx
git commit -m "feat(dashboard): DashboardEditor com fixo + tarefas concluídas + pendentes"
```

---

## Task 17: Roteamento em `page.tsx`

**Files:**
- Modify: `src/app/(authed)/page.tsx`

- [ ] **Step 1: Adicionar imports e branches**

Editar `src/app/(authed)/page.tsx`:

```tsx
import { requireAuth } from "@/lib/auth/session";
import { DashboardSocioAdm } from "@/components/dashboard/DashboardSocioAdm";
import { DashboardCoord } from "@/components/dashboard/DashboardCoord";
import { DashboardAssessor } from "@/components/dashboard/DashboardAssessor";
import { DashboardComercial } from "@/components/dashboard/DashboardComercial";
import { DashboardVideomaker } from "@/components/dashboard/DashboardVideomaker";
import { DashboardDesigner } from "@/components/dashboard/DashboardDesigner";
import { DashboardEditor } from "@/components/dashboard/DashboardEditor";
import { StubGreeting } from "@/components/dashboard/StubGreeting";
import type { Periodo } from "@/lib/dashboard/personal";

const PERIODOS_VALIDOS: ReadonlySet<Periodo> = new Set(["mes_atual", "mes_anterior", "dias_7", "total"]);

function parsePeriodo(raw: string | undefined): Periodo {
  if (raw && PERIODOS_VALIDOS.has(raw as Periodo)) return raw as Periodo;
  return "mes_atual";
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const params = await searchParams;
  const user = await requireAuth();
  const periodo = parsePeriodo(params.periodo);

  if (user.role === "socio" || user.role === "adm") {
    return <DashboardSocioAdm nome={user.nome} />;
  }
  if (user.role === "coordenador") {
    return <DashboardCoord userId={user.id} nome={user.nome} />;
  }
  if (user.role === "assessor") {
    return <DashboardAssessor userId={user.id} nome={user.nome} />;
  }
  if (user.role === "comercial") {
    return <DashboardComercial userId={user.id} nome={user.nome} />;
  }
  if (user.role === "videomaker") {
    return <DashboardVideomaker userId={user.id} nome={user.nome} />;
  }
  if (user.role === "designer") {
    return <DashboardDesigner userId={user.id} nome={user.nome} periodo={periodo} />;
  }
  if (user.role === "editor") {
    return <DashboardEditor userId={user.id} nome={user.nome} periodo={periodo} />;
  }
  return <StubGreeting nome={user.nome} />;
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(authed\)/page.tsx
git commit -m "feat(dashboard): rotear videomaker/designer/editor pros novos dashboards"
```

---

## Task 18: E2E test do fluxo do designer

**Files:**
- Create: `tests/e2e/dashboard-designer.spec.ts`

- [ ] **Step 1: Verificar pattern existente em `tests/e2e/`**

```bash
ls tests/e2e/ && cat tests/e2e/satisfacao.spec.ts | head -30
```

- [ ] **Step 2: Criar teste E2E (esqueleto)**

```ts
// tests/e2e/dashboard-designer.spec.ts
import { test, expect } from "@playwright/test";

// IMPORTANTE: este teste depende de seed/fixtures de um usuário com role=designer.
// Se os testes E2E do projeto usam um setup específico, replicar aqui.
// Ajuste DESIGNER_EMAIL e DESIGNER_PASSWORD conforme suas fixtures.

const DESIGNER_EMAIL = process.env.E2E_DESIGNER_EMAIL ?? "designer-test@yidedigital.com.br";
const DESIGNER_PASSWORD = process.env.E2E_DESIGNER_PASSWORD ?? "test-password";

test.describe("Designer dashboard + modal de artes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', DESIGNER_EMAIL);
    await page.fill('input[name="password"]', DESIGNER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("/");
  });

  test("dashboard mostra fixo, contador de artes e tarefas pendentes", async ({ page }) => {
    await expect(page.getByText(/Olá,/)).toBeVisible();
    await expect(page.getByText(/Seu fixo mensal/i)).toBeVisible();
    await expect(page.getByText(/Artes entregues/i)).toBeVisible();
    await expect(page.getByText(/Tarefas pendentes/i)).toBeVisible();
  });

  test("concluir uma tarefa abre modal de artes; submeter zera contador OK", async ({ page }) => {
    // Premissa: existe pelo menos uma tarefa pendente atribuída ao designer
    const primeiraTarefa = page.locator("ul li a").first();
    await primeiraTarefa.click();

    // Na página de detalhe, clicar em "Marcar como concluída"
    await page.getByRole("button", { name: /Marcar como concluída/i }).click();

    // Modal deve abrir
    await expect(page.getByText(/Quantas artes foram entregues/i)).toBeVisible();

    // Preencher 0 e submeter
    await page.fill('input[name="artes_entregues"]', "0");
    await page.getByRole("button", { name: /Concluir tarefa/i }).click();

    // Modal fecha, status muda
    await expect(page.getByText(/Quantas artes/i)).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /Reabrir/i })).toBeVisible();
  });
});
```

- [ ] **Step 3: Documentar como rodar (não rodar agora — depende de fixtures)**

Adicionar ao topo do arquivo um comentário explicando que este teste roda contra ambiente seedado e pode ser pulado em CI. Se o projeto não tiver fixture de designer, anotar como TODO no README de testes.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/dashboard-designer.spec.ts
git commit -m "test(e2e): fluxo designer dashboard + modal de artes (esqueleto)"
```

---

## Task 19: Verificação final + atualização do CHANGELOG (se houver)

- [ ] **Step 1: Rodar suite completa**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento" && npm run lint && npm run typecheck && npm run test
```

Tudo deve passar.

- [ ] **Step 2: Build local**

```bash
npm run build
```

Sem erros.

- [ ] **Step 3: Push branch e abrir PR**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/loving-heyrovsky-89b69e" && git push -u origin feat/dashboards-executores
```

```bash
gh pr create --title 'feat(dashboard): dashboards de videomaker, designer, editor + modal de artes' --body "$(cat <<'EOF'
## Summary
PR1 da sequência de 3 PRs definida no [spec](docs/superpowers/specs/2026-05-05-dashboards-executores-design.md).

- **Videomaker**: dashboard com fixo mensal + próximas 2 semanas de gravações
- **Designer**: fixo mensal + artes entregues no período (com seletor) + tarefas pendentes em destaque
- **Editor**: fixo mensal + tarefas concluídas no período + tarefas pendentes em destaque
- **Modal "Quantas artes entregues?"**: aparece quando role=designer marca tarefa como concluída. Obrigatório (0 também é válido).
- **Migration**: novo campo `tasks.artes_entregues` (integer null, check >= 0)
- **Action `toggleTaskCompletionAction`** estendida pra aceitar `artesEntregues?: number`

## Test plan
- [ ] Login como videomaker → dashboard mostra próximas gravações (esta semana + próxima)
- [ ] Login como designer → dashboard mostra fixo + contador de artes + tarefas pendentes
- [ ] Designer marca tarefa como concluída → modal aparece, exige número, salva e fecha
- [ ] Login como editor → dashboard mostra fixo + tarefas concluídas no mês + pendentes
- [ ] Outros roles concluindo tarefa → fluxo segue igual (sem modal)
- [ ] Reabrir tarefa concluída → não pede prompt, mantém artes_entregues
- [ ] Filtro de período em designer/editor troca via dropdown

## Pós-merge
1. **Aplicar a migration** — via SQL Editor do Supabase ou `npm run db:push`
2. Verificar dashboards de cada role logando em conta de teste

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Checklist final

- [ ] Migration aplicada (manual pós-merge)
- [ ] Todos os call sites de `toggleTaskCompletionAction` foram migrados pra `<CompleteTaskButton>`
- [ ] Testes unitários verdes
- [ ] Typecheck verde
- [ ] Build verde
- [ ] PR aberto

---

## Notas de implementação

- **Prop `userRole` em TaskCard**: a maioria dos lugares que usa `<TaskCard>` é Server Component que já tem `user.role` via `requireAuth()`. Drill a prop de cima pra baixo.
- **Cache invalidation**: todas as queries usam tag `dashboard` ou `tasks`. Mutations existentes em tarefas já invalidam `tasks`. Verificar se invalidam `dashboard` também — se não, adicionar.
- **Mobile**: o grid `md:grid-cols-2` colapsa pra 1 coluna no mobile automaticamente. Cards e listas são responsivos por padrão.
- **Acessibilidade do modal**: o componente `Dialog` do `@base-ui/react` já gerencia foco e ARIA. Não precisa código extra.
