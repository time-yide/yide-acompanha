# Tarefas Redesign Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar `/tarefas` numa página dual-view estilo ClickUp/Asana — Quadro Kanban arrastável (default) + Lista agrupada (Prazo/Cliente/Responsável/Prioridade), com cards mais densos e edição inline (marcar concluída + drag entre colunas).

**Architecture:** Componentes client-side com URL-driven state (`?view=board|list&groupBy=...`). Drag-drop nativo HTML5 (mesmo padrão do Onboarding). Server action única nova (`moveTaskStatusAction`) pra drag; reusa `toggleTaskCompletionAction` existente pra quick-complete. Helpers de grouping/prazo extraídos em `src/lib/tarefas/grouping.ts` pra serem testáveis em isolamento.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind, lucide-react, vitest, Supabase server actions.

**Spec:** [docs/superpowers/specs/2026-05-04-tarefas-redesign-design.md](../specs/2026-05-04-tarefas-redesign-design.md)

---

## File Map

**Create:**
- `src/lib/tarefas/grouping.ts` — pure functions: `prazoUrgency`, `formatPrazoLabel`, `groupTasksByPrazo`, `groupTasksByCliente`, `groupTasksByResponsavel`, `groupTasksByPrioridade`
- `tests/unit/tarefas-grouping.test.ts` — unit tests dos helpers
- `src/components/tarefas/TaskCard.tsx` — card visual reusado em Quadro e Lista
- `src/components/tarefas/TasksColumn.tsx` — coluna do Kanban
- `src/components/tarefas/TasksBoard.tsx` — orquestra 3 colunas + drag handler
- `src/components/tarefas/TasksGroupedList.tsx` — lista agrupada com seções colapsáveis
- `src/components/tarefas/ViewToggle.tsx` — toggle Quadro/Lista (URL-driven)
- `src/components/tarefas/GroupBySelector.tsx` — dropdown de agrupamento (URL-driven)

**Modify:**
- `src/lib/tarefas/actions.ts` — adiciona `moveTaskStatusAction`
- `src/components/tarefas/TaskFilters.tsx` — remove filtros de Status e Prazo
- `src/app/(authed)/tarefas/page.tsx` — orquestração: lê `?view`, renderiza Board ou Lista; remove parsing de `status`/`prazo`

**Delete:**
- `src/components/tarefas/TasksList.tsx` — substituído por `TasksGroupedList`

---

## Task 1: Helpers de grouping (TDD)

**Files:**
- Create: `src/lib/tarefas/grouping.ts`
- Test: `tests/unit/tarefas-grouping.test.ts`

- [ ] **Step 1: Escreve o teste falhando**

```typescript
// tests/unit/tarefas-grouping.test.ts
import { describe, it, expect } from "vitest";
import {
  prazoUrgency,
  formatPrazoLabel,
  groupTasksByPrazo,
  groupTasksByCliente,
  groupTasksByResponsavel,
  groupTasksByPrioridade,
} from "@/lib/tarefas/grouping";

const TODAY = new Date(2026, 4, 4); // 4 mai 2026 (mês 0-indexed)
const TODAY_ISO = "2026-05-04";

function task(overrides: Partial<{
  id: string;
  due_date: string | null;
  status: "aberta" | "em_andamento" | "concluida";
  prioridade: "alta" | "media" | "baixa";
  cliente: { id: string; nome: string } | null;
  atribuido: { nome: string } | null;
}> = {}) {
  return {
    id: overrides.id ?? "t1",
    titulo: "Tarefa teste",
    prioridade: overrides.prioridade ?? "media",
    status: overrides.status ?? "aberta",
    due_date: overrides.due_date ?? null,
    client_id: null,
    cliente: overrides.cliente ?? null,
    atribuido: overrides.atribuido ?? null,
  };
}

describe("prazoUrgency", () => {
  it("retorna 'none' pra due_date null", () => {
    expect(prazoUrgency(null, TODAY)).toBe("none");
  });
  it("retorna 'overdue' pra data no passado", () => {
    expect(prazoUrgency("2026-05-01", TODAY)).toBe("overdue");
  });
  it("retorna 'today' pra hoje", () => {
    expect(prazoUrgency(TODAY_ISO, TODAY)).toBe("today");
  });
  it("retorna 'week' pra próximos 7 dias inclusive", () => {
    expect(prazoUrgency("2026-05-05", TODAY)).toBe("week");
    expect(prazoUrgency("2026-05-11", TODAY)).toBe("week");
  });
  it("retorna 'future' pra mais de 7 dias", () => {
    expect(prazoUrgency("2026-05-12", TODAY)).toBe("future");
  });
});

describe("formatPrazoLabel", () => {
  it("retorna '—' pra null", () => {
    expect(formatPrazoLabel(null, TODAY)).toBe("—");
  });
  it("retorna 'Hoje' pra hoje", () => {
    expect(formatPrazoLabel(TODAY_ISO, TODAY)).toBe("Hoje");
  });
  it("retorna 'Venceu há Nd' pra passado", () => {
    expect(formatPrazoLabel("2026-05-02", TODAY)).toBe("Venceu há 2d");
  });
  it("retorna 'Em Nd' pra próximos 7 dias", () => {
    expect(formatPrazoLabel("2026-05-07", TODAY)).toBe("Em 3d");
  });
  it("retorna data formatada pt-BR pra futuro distante", () => {
    expect(formatPrazoLabel("2026-06-15", TODAY)).toMatch(/15 de jun/);
  });
});

describe("groupTasksByPrazo", () => {
  it("classifica em 6 buckets (atrasadas/hoje/semana/sem_prazo/futuras/concluidas)", () => {
    const tasks = [
      task({ id: "a", due_date: "2026-05-01", status: "aberta" }),  // atrasada
      task({ id: "b", due_date: TODAY_ISO, status: "aberta" }),     // hoje
      task({ id: "c", due_date: "2026-05-08", status: "aberta" }),  // semana
      task({ id: "d", due_date: "2026-06-01", status: "aberta" }),  // futura
      task({ id: "e", due_date: null, status: "aberta" }),          // sem_prazo
      task({ id: "f", due_date: "2026-04-30", status: "concluida" }), // concluída
    ];
    const g = groupTasksByPrazo(tasks, TODAY);
    expect(g.atrasadas.map((t) => t.id)).toEqual(["a"]);
    expect(g.hoje.map((t) => t.id)).toEqual(["b"]);
    expect(g.semana.map((t) => t.id)).toEqual(["c"]);
    expect(g.futuras.map((t) => t.id)).toEqual(["d"]);
    expect(g.sem_prazo.map((t) => t.id)).toEqual(["e"]);
    expect(g.concluidas.map((t) => t.id)).toEqual(["f"]);
  });
  it("concluída sempre vai pra 'concluidas' independente do due_date", () => {
    const tasks = [task({ id: "x", due_date: TODAY_ISO, status: "concluida" })];
    const g = groupTasksByPrazo(tasks, TODAY);
    expect(g.concluidas).toHaveLength(1);
    expect(g.hoje).toHaveLength(0);
  });
});

describe("groupTasksByCliente", () => {
  it("agrupa por nome do cliente, sem cliente vai pra '(Sem cliente)'", () => {
    const tasks = [
      task({ id: "a", cliente: { id: "c1", nome: "Acme" } }),
      task({ id: "b", cliente: { id: "c1", nome: "Acme" } }),
      task({ id: "c", cliente: null }),
    ];
    const g = groupTasksByCliente(tasks);
    expect(g.get("Acme")?.map((t) => t.id)).toEqual(["a", "b"]);
    expect(g.get("(Sem cliente)")?.map((t) => t.id)).toEqual(["c"]);
  });
});

describe("groupTasksByResponsavel", () => {
  it("agrupa por nome do responsável, sem responsável vai pra '(Sem responsável)'", () => {
    const tasks = [
      task({ id: "a", atribuido: { nome: "Yasmin" } }),
      task({ id: "b", atribuido: null }),
    ];
    const g = groupTasksByResponsavel(tasks);
    expect(g.get("Yasmin")?.map((t) => t.id)).toEqual(["a"]);
    expect(g.get("(Sem responsável)")?.map((t) => t.id)).toEqual(["b"]);
  });
});

describe("groupTasksByPrioridade", () => {
  it("agrupa em alta/media/baixa", () => {
    const tasks = [
      task({ id: "a", prioridade: "alta" }),
      task({ id: "b", prioridade: "media" }),
      task({ id: "c", prioridade: "baixa" }),
    ];
    const g = groupTasksByPrioridade(tasks);
    expect(g.alta.map((t) => t.id)).toEqual(["a"]);
    expect(g.media.map((t) => t.id)).toEqual(["b"]);
    expect(g.baixa.map((t) => t.id)).toEqual(["c"]);
  });
});
```

- [ ] **Step 2: Roda o teste pra confirmar que falha**

Comando: `npx vitest run tests/unit/tarefas-grouping.test.ts`
Esperado: FAIL com "Cannot find module '@/lib/tarefas/grouping'"

- [ ] **Step 3: Implementa os helpers**

```typescript
// src/lib/tarefas/grouping.ts
import { localIsoDate } from "@/lib/utils/date";
import type { TaskRow } from "./queries";

export type PrazoUrgency = "overdue" | "today" | "week" | "future" | "none";

export function prazoUrgency(due_date: string | null, today: Date = new Date()): PrazoUrgency {
  if (!due_date) return "none";
  const todayIso = localIsoDate(today);
  const in7Date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
  const in7Iso = localIsoDate(in7Date);
  if (due_date < todayIso) return "overdue";
  if (due_date === todayIso) return "today";
  if (due_date <= in7Iso) return "week";
  return "future";
}

export function formatPrazoLabel(due_date: string | null, today: Date = new Date()): string {
  if (!due_date) return "—";
  const todayIso = localIsoDate(today);
  if (due_date === todayIso) return "Hoje";
  // Calcula diff em dias usando datas locais (sem TZ trickery)
  const [y, m, d] = due_date.split("-").map(Number);
  const dueLocal = new Date(y, m - 1, d);
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round((dueLocal.getTime() - todayLocal.getTime()) / 86400000);
  if (diffDays < 0) return `Venceu há ${-diffDays}d`;
  if (diffDays <= 7) return `Em ${diffDays}d`;
  return dueLocal.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
}

export const PRAZO_GROUPS = ["atrasadas", "hoje", "semana", "sem_prazo", "futuras", "concluidas"] as const;
export type PrazoGroupKey = (typeof PRAZO_GROUPS)[number];

export const PRAZO_GROUP_LABELS: Record<PrazoGroupKey, string> = {
  atrasadas: "Atrasadas",
  hoje: "Hoje",
  semana: "Esta semana",
  sem_prazo: "Sem prazo",
  futuras: "Futuras",
  concluidas: "Concluídas",
};

export function groupTasksByPrazo(
  tasks: TaskRow[],
  today: Date = new Date(),
): Record<PrazoGroupKey, TaskRow[]> {
  const groups: Record<PrazoGroupKey, TaskRow[]> = {
    atrasadas: [], hoje: [], semana: [], sem_prazo: [], futuras: [], concluidas: [],
  };
  for (const t of tasks) {
    if (t.status === "concluida") {
      groups.concluidas.push(t);
      continue;
    }
    const u = prazoUrgency(t.due_date, today);
    if (u === "overdue") groups.atrasadas.push(t);
    else if (u === "today") groups.hoje.push(t);
    else if (u === "week") groups.semana.push(t);
    else if (u === "future") groups.futuras.push(t);
    else groups.sem_prazo.push(t);
  }
  return groups;
}

export function groupTasksByCliente(tasks: TaskRow[]): Map<string, TaskRow[]> {
  const out = new Map<string, TaskRow[]>();
  for (const t of tasks) {
    const key = t.cliente?.nome ?? "(Sem cliente)";
    const arr = out.get(key) ?? [];
    arr.push(t);
    out.set(key, arr);
  }
  return out;
}

export function groupTasksByResponsavel(tasks: TaskRow[]): Map<string, TaskRow[]> {
  const out = new Map<string, TaskRow[]>();
  for (const t of tasks) {
    const key = t.atribuido?.nome ?? "(Sem responsável)";
    const arr = out.get(key) ?? [];
    arr.push(t);
    out.set(key, arr);
  }
  return out;
}

export function groupTasksByPrioridade(tasks: TaskRow[]): Record<"alta" | "media" | "baixa", TaskRow[]> {
  return {
    alta: tasks.filter((t) => t.prioridade === "alta"),
    media: tasks.filter((t) => t.prioridade === "media"),
    baixa: tasks.filter((t) => t.prioridade === "baixa"),
  };
}
```

- [ ] **Step 4: Roda os tests pra confirmar que passa**

Comando: `npx vitest run tests/unit/tarefas-grouping.test.ts`
Esperado: PASS (14 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/tarefas/grouping.ts tests/unit/tarefas-grouping.test.ts
git commit -m "feat(tarefas): helpers de agrupamento + urgência de prazo"
```

---

## Task 2: Server action `moveTaskStatusAction`

**Files:**
- Modify: `src/lib/tarefas/actions.ts` (adicionar função no fim, antes do `deleteTaskAction`)

- [ ] **Step 1: Adiciona schema de validação**

Em `src/lib/tarefas/schema.ts`, adiciona ao final:

```typescript
export const moveStatusSchema = z.object({
  id: z.string().uuid(),
  to_status: z.enum(TASK_STATUSES),
});
```

- [ ] **Step 2: Implementa `moveTaskStatusAction` em `src/lib/tarefas/actions.ts`**

Adiciona o import no topo do arquivo:

```typescript
import { createTaskSchema, editTaskSchema, moveStatusSchema } from "./schema";
```

E insere a função antes de `deleteTaskAction`:

```typescript
/**
 * Atualiza apenas o status de uma tarefa (usado por drag-drop no Quadro Kanban).
 * Para toggle simples aberta↔concluida via quick-complete, usa toggleTaskCompletionAction.
 *
 * Permissão: criador, atribuído, ou sócio/adm.
 * Side effects: atualiza completed_at, audit log, dispatch de notificação quando vai pra concluida.
 */
export async function moveTaskStatusAction(formData: FormData) {
  const actor = await requireAuth();

  const parsed = moveStatusSchema.safeParse({
    id: fd(formData, "id"),
    to_status: fd(formData, "to_status"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: before } = await supabase.from("tasks").select("*").eq("id", parsed.data.id).single();
  if (!before) return { error: "Tarefa não encontrada" };

  const canMove =
    before.criado_por === actor.id ||
    before.atribuido_a === actor.id ||
    isPrivileged(actor);
  if (!canMove) return { error: "Sem permissão" };

  if (before.status === parsed.data.to_status) {
    return { success: true as const };
  }

  // Lógica do completed_at idêntica ao updateTaskAction
  const completed_at =
    parsed.data.to_status === "concluida" && before.status !== "concluida"
      ? new Date().toISOString()
      : parsed.data.to_status !== "concluida"
        ? null
        : before.completed_at;

  type Patch = { status: "aberta" | "em_andamento" | "concluida"; completed_at: string | null };
  const patch: Patch = { status: parsed.data.to_status, completed_at };

  const { error } = await supabase.from("tasks").update(patch).eq("id", parsed.data.id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "tasks",
    entidade_id: parsed.data.id,
    acao: parsed.data.to_status === "concluida" ? "complete" : before.status === "concluida" ? "reopen" : "update",
    dados_antes: { status: before.status, completed_at: before.completed_at },
    dados_depois: patch as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  if (parsed.data.to_status === "concluida" && before.status !== "concluida") {
    await dispatchNotification({
      evento_tipo: "task_completed",
      titulo: "Tarefa concluída",
      mensagem: `${actor.nome} concluiu: "${before.titulo}"`,
      link: `/tarefas/${parsed.data.id}`,
      user_ids_extras: [before.criado_por],
      source_user_id: actor.id,
    });
  }

  revalidatePath("/tarefas");
  revalidatePath(`/tarefas/${parsed.data.id}`);
  if (before.client_id) revalidatePath(`/clientes/${before.client_id}/tarefas`);
  return { success: true as const };
}
```

- [ ] **Step 3: Verifica typecheck**

Comando: `npx tsc --noEmit`
Esperado: EXIT=0

- [ ] **Step 4: Commit**

```bash
git add src/lib/tarefas/schema.ts src/lib/tarefas/actions.ts
git commit -m "feat(tarefas): server action moveTaskStatusAction (drag entre colunas)"
```

---

## Task 3: TaskCard component (compartilhado)

**Files:**
- Create: `src/components/tarefas/TaskCard.tsx`

- [ ] **Step 1: Implementa o componente**

```tsx
// src/components/tarefas/TaskCard.tsx
"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Check } from "lucide-react";
import { toggleTaskCompletionAction } from "@/lib/tarefas/actions";
import { prazoUrgency, formatPrazoLabel, type PrazoUrgency } from "@/lib/tarefas/grouping";
import type { TaskRow } from "@/lib/tarefas/queries";
import { cn } from "@/lib/utils";

interface Props {
  task: TaskRow;
  /** Quando true, card é arrastável (Quadro). Padrão: false (Lista). */
  draggable?: boolean;
}

const PRIORITY_DOT: Record<string, string> = {
  alta: "bg-rose-500",
  media: "bg-amber-500",
  baixa: "bg-slate-400",
};

const PRAZO_PILL: Record<PrazoUrgency, string> = {
  overdue: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
  today: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  week: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
  future: "bg-muted text-muted-foreground border-border",
  none: "bg-muted/40 text-muted-foreground border-border",
};

/** Iniciais do nome (até 2 chars). "Yasmin Monteiro" → "YM" */
function initials(nome: string | undefined | null): string {
  if (!nome) return "—";
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Hash do userId em uma das 8 cores da paleta — determinístico. */
function avatarBg(userId: string | undefined | null): string {
  const palette = [
    "bg-emerald-500/30 text-emerald-700 dark:text-emerald-300",
    "bg-sky-500/30 text-sky-700 dark:text-sky-300",
    "bg-amber-500/30 text-amber-700 dark:text-amber-300",
    "bg-rose-500/30 text-rose-700 dark:text-rose-300",
    "bg-violet-500/30 text-violet-700 dark:text-violet-300",
    "bg-teal-500/30 text-teal-700 dark:text-teal-300",
    "bg-orange-500/30 text-orange-700 dark:text-orange-300",
    "bg-pink-500/30 text-pink-700 dark:text-pink-300",
  ];
  if (!userId) return palette[0];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

export function TaskCard({ task, draggable = false }: Props) {
  const [pending, startTransition] = useTransition();

  function onDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("text/task-id", task.id);
    e.dataTransfer.setData("text/from-status", task.status);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleQuickComplete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      await toggleTaskCompletionAction(task.id);
    });
  }

  const urgency = prazoUrgency(task.due_date);
  const isCompleted = task.status === "concluida";
  const responsavelNome = task.atribuido?.nome ?? null;
  const responsavelId = task.atribuido?.id ?? null;
  const clienteNome = task.cliente?.nome ?? null;

  return (
    <Link
      href={`/tarefas/${task.id}`}
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      className={cn(
        "group relative block rounded-lg border bg-card p-3 transition-all hover:bg-card/80 hover:shadow-sm",
        draggable && "cursor-grab active:cursor-grabbing [&[draggable=true]:active]:opacity-50",
        isCompleted && "opacity-70",
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn("mt-1.5 h-2 w-2 flex-shrink-0 rounded-full", PRIORITY_DOT[task.prioridade])}
          aria-label={`Prioridade ${task.prioridade}`}
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className={cn("text-sm font-medium leading-snug", isCompleted && "line-through text-muted-foreground")}>
            {task.titulo}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {responsavelNome && (
              <span
                title={responsavelNome}
                className={cn(
                  "inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold",
                  avatarBg(responsavelId),
                )}
              >
                {initials(responsavelNome)}
              </span>
            )}
            {clienteNome && (
              <span className="truncate rounded-md border bg-muted/40 px-1.5 py-0.5 text-[10px] max-w-[140px]">
                {clienteNome}
              </span>
            )}
            <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px]", PRAZO_PILL[urgency])}>
              {formatPrazoLabel(task.due_date)}
            </span>
          </div>
        </div>
        {!isCompleted && (
          <button
            type="button"
            onClick={handleQuickComplete}
            disabled={pending}
            title="Marcar concluída"
            className="absolute right-2 top-2 hidden h-6 w-6 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 group-hover:inline-flex dark:text-emerald-400 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Verifica typecheck**

Comando: `npx tsc --noEmit`
Esperado: EXIT=0

- [ ] **Step 3: Commit**

```bash
git add src/components/tarefas/TaskCard.tsx
git commit -m "feat(tarefas): TaskCard compartilhado (prioridade dot + avatar + cliente + prazo pill + quick-complete)"
```

---

## Task 4: Quadro Kanban (TasksColumn + TasksBoard)

**Files:**
- Create: `src/components/tarefas/TasksColumn.tsx`
- Create: `src/components/tarefas/TasksBoard.tsx`

- [ ] **Step 1: Implementa TasksColumn**

```tsx
// src/components/tarefas/TasksColumn.tsx
"use client";

import { useState } from "react";
import { TaskCard } from "./TaskCard";
import type { TaskRow } from "@/lib/tarefas/queries";
import { cn } from "@/lib/utils";

type Status = "aberta" | "em_andamento" | "concluida";

const COLUMN_LABEL: Record<Status, string> = {
  aberta: "A fazer",
  em_andamento: "Em andamento",
  concluida: "Concluídas",
};

interface Props {
  status: Status;
  tasks: TaskRow[];
  onDropTask: (taskId: string, fromStatus: Status) => void;
}

export function TasksColumn({ status, tasks, onDropTask }: Props) {
  const [isOver, setIsOver] = useState(false);

  function onDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes("text/task-id")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (!isOver) setIsOver(true);
    }
  }

  function onDragLeave(e: React.DragEvent) {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsOver(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsOver(false);
    const taskId = e.dataTransfer.getData("text/task-id");
    const fromStatus = e.dataTransfer.getData("text/from-status") as Status;
    if (!taskId || !fromStatus || fromStatus === status) return;
    onDropTask(taskId, fromStatus);
  }

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "flex w-[300px] flex-shrink-0 flex-col rounded-xl border bg-muted/20 transition-colors",
        isOver && "border-primary bg-primary/5 ring-2 ring-primary/30",
      )}
    >
      <div className="border-b px-3 py-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{COLUMN_LABEL[status]}</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{tasks.length}</span>
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2 max-h-[calc(100vh-280px)]">
        {tasks.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">Vazio</p>
        ) : (
          tasks.map((t) => <TaskCard key={t.id} task={t} draggable />)
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implementa TasksBoard**

```tsx
// src/components/tarefas/TasksBoard.tsx
"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { TasksColumn } from "./TasksColumn";
import { moveTaskStatusAction } from "@/lib/tarefas/actions";
import type { TaskRow } from "@/lib/tarefas/queries";

type Status = "aberta" | "em_andamento" | "concluida";
const STATUSES: Status[] = ["aberta", "em_andamento", "concluida"];

export function TasksBoard({ tasks }: { tasks: TaskRow[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const groups: Record<Status, TaskRow[]> = {
    aberta: [],
    em_andamento: [],
    concluida: [],
  };
  for (const t of tasks) {
    groups[t.status as Status].push(t);
  }

  function handleDrop(taskId: string, _fromStatus: Status, toStatus: Status) {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", taskId);
      fd.set("to_status", toStatus);
      const r = await moveTaskStatusAction(fd);
      if (r && "error" in r && r.error) setError(r.error);
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-destructive/70 hover:text-destructive">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className={pending ? "overflow-x-auto pb-4 opacity-70 pointer-events-none" : "overflow-x-auto pb-4"}>
        <div className="flex gap-3">
          {STATUSES.map((s) => (
            <TasksColumn
              key={s}
              status={s}
              tasks={groups[s]}
              onDropTask={(taskId, fromStatus) => handleDrop(taskId, fromStatus, s)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verifica typecheck**

Comando: `npx tsc --noEmit`
Esperado: EXIT=0

- [ ] **Step 4: Commit**

```bash
git add src/components/tarefas/TasksBoard.tsx src/components/tarefas/TasksColumn.tsx
git commit -m "feat(tarefas): Quadro Kanban com 3 colunas (drag-drop entre status)"
```

---

## Task 5: Lista agrupada (TasksGroupedList)

**Files:**
- Create: `src/components/tarefas/TasksGroupedList.tsx`

- [ ] **Step 1: Implementa o componente**

```tsx
// src/components/tarefas/TasksGroupedList.tsx
"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TaskCard } from "./TaskCard";
import {
  groupTasksByPrazo,
  groupTasksByCliente,
  groupTasksByResponsavel,
  groupTasksByPrioridade,
  PRAZO_GROUPS,
  PRAZO_GROUP_LABELS,
} from "@/lib/tarefas/grouping";
import type { TaskRow } from "@/lib/tarefas/queries";

export type GroupBy = "prazo" | "cliente" | "responsavel" | "prioridade";

interface Section {
  key: string;
  label: string;
  tasks: TaskRow[];
  collapsedByDefault?: boolean;
}

const PRIO_LABEL: Record<"alta" | "media" | "baixa", string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

function buildSections(tasks: TaskRow[], groupBy: GroupBy): Section[] {
  if (groupBy === "prazo") {
    const g = groupTasksByPrazo(tasks);
    return PRAZO_GROUPS
      .map((k) => ({
        key: k,
        label: PRAZO_GROUP_LABELS[k],
        tasks: g[k],
        collapsedByDefault: k === "concluidas",
      }))
      .filter((s) => s.tasks.length > 0);
  }
  if (groupBy === "cliente") {
    const m = groupTasksByCliente(tasks);
    return [...m.entries()]
      .sort(([a], [b]) => {
        if (a === "(Sem cliente)") return 1;
        if (b === "(Sem cliente)") return -1;
        return a.localeCompare(b, "pt-BR");
      })
      .map(([k, ts]) => ({ key: k, label: k, tasks: ts }));
  }
  if (groupBy === "responsavel") {
    const m = groupTasksByResponsavel(tasks);
    return [...m.entries()]
      .sort(([a], [b]) => {
        if (a === "(Sem responsável)") return 1;
        if (b === "(Sem responsável)") return -1;
        return a.localeCompare(b, "pt-BR");
      })
      .map(([k, ts]) => ({ key: k, label: k, tasks: ts }));
  }
  // prioridade
  const g = groupTasksByPrioridade(tasks);
  return (["alta", "media", "baixa"] as const)
    .map((k) => ({ key: k, label: PRIO_LABEL[k], tasks: g[k] }))
    .filter((s) => s.tasks.length > 0);
}

export function TasksGroupedList({ tasks, groupBy }: { tasks: TaskRow[]; groupBy: GroupBy }) {
  const sections = buildSections(tasks, groupBy);
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(sections.filter((s) => s.collapsedByDefault).map((s) => s.key)),
  );

  if (sections.length === 0) {
    return (
      <p className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">Nenhuma tarefa.</p>
    );
  }

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {sections.map((s) => {
        const isCollapsed = collapsed.has(s.key);
        return (
          <section key={s.key} className="space-y-2">
            <button
              type="button"
              onClick={() => toggle(s.key)}
              className="flex w-full items-center gap-2 text-sm font-semibold text-foreground hover:text-primary"
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <span>{s.label}</span>
              <span className="text-xs font-normal text-muted-foreground">· {s.tasks.length}</span>
            </button>
            {!isCollapsed && (
              <div className="space-y-2 pl-6">
                {s.tasks.map((t) => <TaskCard key={t.id} task={t} />)}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verifica typecheck**

Comando: `npx tsc --noEmit`
Esperado: EXIT=0

- [ ] **Step 3: Commit**

```bash
git add src/components/tarefas/TasksGroupedList.tsx
git commit -m "feat(tarefas): Lista agrupada com seções colapsáveis (prazo/cliente/responsável/prioridade)"
```

---

## Task 6: ViewToggle + GroupBySelector

**Files:**
- Create: `src/components/tarefas/ViewToggle.tsx`
- Create: `src/components/tarefas/GroupBySelector.tsx`

- [ ] **Step 1: Implementa ViewToggle**

```tsx
// src/components/tarefas/ViewToggle.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

export function ViewToggle({ current }: { current: "board" | "list" }) {
  const router = useRouter();
  const params = useSearchParams();

  function setView(v: "board" | "list") {
    const sp = new URLSearchParams(params.toString());
    if (v === "board") sp.delete("view");
    else sp.set("view", v);
    router.push(`/tarefas?${sp.toString()}`);
  }

  return (
    <div className="inline-flex items-center rounded-md border bg-card p-0.5">
      <button
        type="button"
        onClick={() => setView("board")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
          current === "board" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" /> Quadro
      </button>
      <button
        type="button"
        onClick={() => setView("list")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
          current === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <List className="h-3.5 w-3.5" /> Lista
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Implementa GroupBySelector**

```tsx
// src/components/tarefas/GroupBySelector.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { GroupBy } from "./TasksGroupedList";

export function GroupBySelector({ current }: { current: GroupBy }) {
  const router = useRouter();
  const params = useSearchParams();

  function setGroupBy(v: string) {
    const sp = new URLSearchParams(params.toString());
    if (!v || v === "prazo") sp.delete("groupBy");
    else sp.set("groupBy", v);
    router.push(`/tarefas?${sp.toString()}`);
  }

  return (
    <div className="space-y-1">
      <Label className="text-[11px]">Agrupar por</Label>
      <Select value={current} onValueChange={setGroupBy}>
        <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="prazo">Prazo</SelectItem>
          <SelectItem value="cliente">Cliente</SelectItem>
          <SelectItem value="responsavel">Responsável</SelectItem>
          <SelectItem value="prioridade">Prioridade</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
```

- [ ] **Step 3: Verifica typecheck**

Comando: `npx tsc --noEmit`
Esperado: EXIT=0

- [ ] **Step 4: Commit**

```bash
git add src/components/tarefas/ViewToggle.tsx src/components/tarefas/GroupBySelector.tsx
git commit -m "feat(tarefas): ViewToggle (Quadro/Lista) e GroupBySelector (URL-driven)"
```

---

## Task 7: Atualiza TaskFilters (remove Status + Prazo)

**Files:**
- Modify: `src/components/tarefas/TaskFilters.tsx`

- [ ] **Step 1: Substitui o conteúdo do arquivo**

```tsx
// src/components/tarefas/TaskFilters.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface ProfileOption { id: string; nome: string; }
interface ClientOption { id: string; nome: string; }

interface Props {
  profiles: ProfileOption[];
  clientes: ClientOption[];
  showAtribuido: boolean;
}

export function TaskFilters({ profiles, clientes, showAtribuido }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const sp = new URLSearchParams(params.toString());
    if (!value || value === "qualquer") sp.delete(key);
    else sp.set(key, value);
    router.push(`/tarefas?${sp.toString()}`);
  }

  const prioridade = params.get("prioridade") ?? "qualquer";
  const clientId = params.get("client") ?? "qualquer";
  const atribuido = params.get("atribuido") ?? "qualquer";

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-[11px]">Prioridade</Label>
        <Select value={prioridade} onValueChange={(v) => setParam("prioridade", v as string)}>
          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="qualquer">Qualquer</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Média</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">Cliente</Label>
        <Select value={clientId} onValueChange={(v) => setParam("client", v as string)}>
          <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="qualquer">Qualquer</SelectItem>
            {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {showAtribuido && (
        <div className="space-y-1">
          <Label className="text-[11px]">Responsável</Label>
          <Select value={atribuido} onValueChange={(v) => setParam("atribuido", v as string)}>
            <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="qualquer">Qualquer</SelectItem>
              {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verifica typecheck**

Comando: `npx tsc --noEmit`
Esperado: EXIT=0

- [ ] **Step 3: Commit**

```bash
git add src/components/tarefas/TaskFilters.tsx
git commit -m "refactor(tarefas): remove filtros Status e Prazo (Quadro vira pelo status, Lista pelo agrupamento)"
```

---

## Task 8: Atualiza tarefas/page.tsx (orquestração)

**Files:**
- Modify: `src/app/(authed)/tarefas/page.tsx`

- [ ] **Step 1: Substitui o conteúdo do arquivo**

```tsx
// src/app/(authed)/tarefas/page.tsx
import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listTasks, type TaskFilters as TaskFiltersData } from "@/lib/tarefas/queries";
import { TasksBoard } from "@/components/tarefas/TasksBoard";
import { TasksGroupedList, type GroupBy } from "@/components/tarefas/TasksGroupedList";
import { TaskFilters } from "@/components/tarefas/TaskFilters";
import { ViewToggle } from "@/components/tarefas/ViewToggle";
import { GroupBySelector } from "@/components/tarefas/GroupBySelector";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

type Aba = "minhas" | "criadas" | "todas";
type View = "board" | "list";

const VALID_GROUP_BY: GroupBy[] = ["prazo", "cliente", "responsavel", "prioridade"];

interface SearchParams {
  aba?: string;
  view?: string;
  groupBy?: string;
  prioridade?: string;
  client?: string;
  atribuido?: string;
}

export default async function TarefasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireAuth();

  const aba: Aba =
    params.aba === "criadas" ? "criadas" : params.aba === "todas" ? "todas" : "minhas";
  const view: View = params.view === "list" ? "list" : "board";
  const groupBy: GroupBy = VALID_GROUP_BY.includes(params.groupBy as GroupBy)
    ? (params.groupBy as GroupBy)
    : "prazo";

  const filters: TaskFiltersData = {};
  if (params.prioridade && params.prioridade !== "qualquer") {
    filters.prioridade = [params.prioridade as "alta" | "media" | "baixa"];
  }
  if (params.client && params.client !== "qualquer") filters.clientId = params.client;

  // Sem filtro de status — Quadro mostra todas as colunas; Lista agrupa concluídas em seção própria
  if (aba === "minhas") filters.atribuidoA = user.id;
  else if (aba === "criadas") filters.criadoPor = user.id;
  else if (aba === "todas" && params.atribuido && params.atribuido !== "qualquer") {
    filters.atribuidoA = params.atribuido;
  }

  const tasks = await listTasks(filters);

  const supabase = await createClient();
  const [{ data: profiles = [] }, { data: clientes = [] }] = await Promise.all([
    supabase.from("profiles").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("clients").select("id, nome").eq("status", "ativo").order("nome"),
  ]);

  function tabHref(slug: Aba) {
    const sp = new URLSearchParams();
    if (slug !== "minhas") sp.set("aba", slug);
    if (view !== "board") sp.set("view", view);
    return `/tarefas?${sp.toString()}`;
  }

  function tabLink(slug: Aba, label: string) {
    const active = aba === slug;
    return (
      <Link
        key={slug}
        href={tabHref(slug)}
        className={active ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground"}
      >
        {label}
      </Link>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tarefas</h1>
          <p className="text-sm text-muted-foreground">{tasks.length} resultado(s)</p>
        </div>
        <Link href="/tarefas/nova">
          <Button>
            <Plus className="mr-2 h-4 w-4" />Nova tarefa
          </Button>
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        {tabLink("minhas", "Atribuídas a mim")}
        <span className="text-muted-foreground">·</span>
        {tabLink("criadas", "Criadas por mim")}
        <span className="text-muted-foreground">·</span>
        {tabLink("todas", "Todas")}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-end gap-3">
          <ViewToggle current={view} />
          {view === "list" && <GroupBySelector current={groupBy} />}
        </div>
        <TaskFilters
          profiles={(profiles ?? []) as { id: string; nome: string }[]}
          clientes={(clientes ?? []) as { id: string; nome: string }[]}
          showAtribuido={aba === "todas"}
        />
      </div>

      {view === "board" ? (
        <TasksBoard tasks={tasks} />
      ) : (
        <TasksGroupedList tasks={tasks} groupBy={groupBy} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verifica typecheck**

Comando: `npx tsc --noEmit`
Esperado: EXIT=0

- [ ] **Step 3: Verifica lint**

Comando: `npx eslint "src/app/(authed)/tarefas/page.tsx" src/components/tarefas/`
Esperado: silencioso (sem erros)

- [ ] **Step 4: Commit**

```bash
git add "src/app/(authed)/tarefas/page.tsx"
git commit -m "feat(tarefas): page.tsx orquestra Quadro/Lista com URL state (?view, ?groupBy)"
```

---

## Task 9: Cleanup — remove TasksList antigo

**Files:**
- Delete: `src/components/tarefas/TasksList.tsx`

- [ ] **Step 1: Confirma que não há mais imports**

Comando: `grep -rn "components/tarefas/TasksList\|from \"@/components/tarefas/TasksList\"" src/ --include="*.ts" --include="*.tsx"`
Esperado: nenhum match (zero linhas)

- [ ] **Step 2: Deleta o arquivo**

```bash
rm src/components/tarefas/TasksList.tsx
```

- [ ] **Step 3: Roda typecheck final**

Comando: `npx tsc --noEmit`
Esperado: EXIT=0

- [ ] **Step 4: Roda todos os tests pra confirmar zero regressão**

Comando: `npx vitest run 2>&1 | tail -5`
Esperado: tests passam (mesmas 7 falhas pré-existentes do baseline; novos 14 do `tarefas-grouping.test.ts` passam)

- [ ] **Step 5: Commit**

```bash
git add -u src/components/tarefas/TasksList.tsx
git commit -m "chore(tarefas): remove TasksList.tsx órfão (substituído por TasksGroupedList)"
```

---

## Task 10: PR final

**Files:**
- Nenhuma mudança de código.

- [ ] **Step 1: Push do branch**

```bash
git push -u origin claude/tarefas-redesign-phase1
```

- [ ] **Step 2: Cria PR**

```bash
gh pr create --title "feat(tarefas): redesign Phase 1 — Quadro Kanban + Lista agrupada + cards densos" --body "$(cat <<'EOF'
## Summary

Tarefas vira página dual-view estilo ClickUp/Asana:
- **Quadro Kanban** (default): 3 colunas (A fazer / Em andamento / Concluídas), arrasta entre elas → atualiza status
- **Lista agrupada**: agrupamento configurável por Prazo (default) / Cliente / Responsável / Prioridade, com seções colapsáveis
- **Cards densos**: prioridade dot + avatar do responsável + badge cliente + pill de prazo colorida por urgência (vermelho atrasada, amarelo hoje, azul próx 7d, cinza futuro). Hover mostra ✓ pra quick-complete.
- **URL state**: \`?view=board|list&groupBy=...\` — bookmarkable
- **Filtros simplificados**: removidos Status (redundante com Quadro) e Prazo (redundante com agrupamento). Mantém Prioridade, Cliente, Responsável (só "Todas").

## Implementação

- Helpers de agrupamento + urgência de prazo extraídos em \`src/lib/tarefas/grouping.ts\` com 14 unit tests
- Server action nova \`moveTaskStatusAction\` (drag entre colunas). Quick-complete reusa \`toggleTaskCompletionAction\` existente
- Drag-drop nativo HTML5 (mesmo padrão do Kanban de Onboarding)
- Componentes novos: \`TaskCard\`, \`TasksBoard\`, \`TasksColumn\`, \`TasksGroupedList\`, \`ViewToggle\`, \`GroupBySelector\`
- \`TasksList.tsx\` antigo removido (substituído por \`TasksGroupedList\`)

## Phase 2 (futuro PR)

Calendário/timeline, edição inline de prazo/responsável/cliente direto no card, drag pra reordenar dentro da coluna, subtasks.

## Test plan

- [ ] \`/tarefas\` abre no Quadro com 3 colunas e contador correto
- [ ] Drag de card entre colunas atualiza status na DB (e \`completed_at\` quando vai pra concluída)
- [ ] Quick-complete (✓ no hover) marca tarefa como concluída sem sair da página
- [ ] Toggle pra Lista mostra agrupamento por Prazo (default), com "Concluídas" colapsada
- [ ] Trocar agrupamento pra Cliente / Responsável / Prioridade re-agrupa corretamente
- [ ] Filtros Prioridade / Cliente / Responsável funcionam em ambas as views
- [ ] Cards mostram dot de prioridade, avatar do responsável (com cor consistente), badge do cliente, pill de prazo colorida
- [ ] Sem prazo → pill cinza "—"; atrasada → vermelho "Venceu há Nd"; hoje → amarelo "Hoje"; próx 7d → azul "Em Nd"
- [ ] Aba "Todas" mostra filtro Responsável; outras abas escondem
- [ ] Tests unit (\`tarefas-grouping.test.ts\`) passam (14 cases)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review checklist (run before handoff)

- [x] Spec coverage: cada seção do spec tem task correspondente (Layout → T8; Quadro → T4; Card → T3; Lista → T5; Filtros → T7; ViewToggle/GroupBy → T6; Action → T2; Helpers → T1; Cleanup → T9; testes → T1).
- [x] Sem placeholders: cada step tem código completo, comandos exatos, expected output.
- [x] Type consistency: `Status` (T4 + T8) / `GroupBy` (T5 + T6 + T8) / `PrazoUrgency` (T1 + T3) batem em todos os lugares onde aparecem.
- [x] Permissions: `moveTaskStatusAction` (T2) usa o mesmo check do `updateTaskAction` existente (criador OR atribuído OR sócio/adm).
