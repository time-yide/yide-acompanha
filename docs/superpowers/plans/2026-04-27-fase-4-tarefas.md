# Fase 4 — Tarefas (Yide Digital) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar a Fase 4 (Tarefas) integrando notificações in-app, audit log, permissões corretas (ADM/Sócio), delete, filtros ricos e a aba "Tarefas" dentro da pasta do cliente. **Aproveita o backend e UI básicos já existentes** e refatora pra alinhar 100% com a spec aprovada.

**Architecture:** Refactor incremental. A tabela `tasks` já existe. Adicionamos a tabela `notifications` (genérica, reutilizável em fases futuras), enriquecemos as actions de tarefas com audit log + triggers de notificação + permissões corretas, e adicionamos as telas que faltam. Sem novas dependências.

**Tech Stack:** Next.js 16 + Supabase (Postgres + RLS) + Base UI + Tailwind + Zod + Vitest + Playwright. Sem Radix/shadcn. Sem cron, sem email (ficam pra Fase 5).

**Spec:** [docs/superpowers/specs/2026-04-27-fase-4-tarefas-design.md](../specs/2026-04-27-fase-4-tarefas-design.md)

**Plano anterior:** [Fase 3 — Calendário Interno](2026-04-27-fase-3-calendario-interno.md)

**Fora do escopo (intencional):**
- Cron pra detectar 24h-antes-do-prazo / overdue → Fase 5
- Email via Resend → Fase 5
- Destinatários customizáveis (`notification_rules`) → Fase 5
- Notificações de outras features (kanban, satisfação, comissão, calendário) → Fase 5
- Subtarefas, comentários, anexos, tags, recorrência → futuro
- Searchable combobox (Select básico do Base UI atende ~15 colaboradores e ~110 clientes)

**Estado atual no repositório (já existe, será refatorado):**
- `supabase/migrations/20260427000003_tasks.sql` (mantém — não vamos mexer no schema da tabela)
- `src/lib/tarefas/schema.ts`, `queries.ts`, `actions.ts` (refatorar)
- `src/components/tarefas/TasksList.tsx`, `PriorityBadge.tsx`, `TaskForm.tsx` (mantém)
- `src/app/(authed)/tarefas/page.tsx`, `nova/page.tsx`, `[id]/page.tsx` (refatorar página principal pra adicionar filtros ricos)
- Sidebar global já tem item "Tarefas" → `/tarefas`
- ClienteSidebar já tem item "Tarefas" → `/clientes/[id]/tarefas` (página ainda não existe)
- TopBar já tem ícone `<Bell>` estático (vamos substituir por componente real)
- `tests/unit/tarefas-schema.test.ts` existe (4 testes — vamos atualizar)

**Estrutura final esperada (delta sobre o que já existe):**

```
supabase/migrations/
└── 20260427000008_notifications.sql              [NEW]

src/
├── app/(authed)/
│   ├── notificacoes/page.tsx                     [NEW]
│   └── clientes/[id]/tarefas/page.tsx            [NEW]
│
├── components/
│   ├── notificacoes/
│   │   ├── NotificationBell.tsx                  [NEW — client component]
│   │   └── NotificationItem.tsx                  [NEW]
│   ├── tarefas/
│   │   └── TaskFilters.tsx                       [NEW — client component]
│   └── layout/
│       └── TopBar.tsx                            [MODIFY — montar NotificationBell]
│
├── lib/
│   ├── tarefas/
│   │   ├── schema.ts                             [MODIFY — title min 2 + prazo no futuro]
│   │   ├── queries.ts                            [MODIFY — sort + filtros prazo + listTasksForClient]
│   │   └── actions.ts                            [MODIFY — audit log, ADM/Sócio, delete, triggers]
│   └── notificacoes/                             [NEW dir]
│       ├── schema.ts                             [NEW]
│       ├── queries.ts                            [NEW]
│       ├── actions.ts                            [NEW]
│       └── trigger.ts                            [NEW]
│
└── types/database.ts                             [REGENERATE]

tests/
├── unit/
│   ├── tarefas-schema.test.ts                    [MODIFY — adicionar testes novos]
│   ├── tarefas-queries.test.ts                   [NEW — sort + filtros]
│   └── notificacoes-trigger.test.ts              [NEW — idempotência]
└── e2e/
    └── tarefas.spec.ts                           [NEW — auth-redirect das 4 rotas]
```

**Total estimado:** ~11 commits.

---

## Bloco A — Migration de notifications

### Task A1: Criar tabela `notifications` + RLS

**Files:**
- Create: `supabase/migrations/20260427000008_notifications.sql`

- [ ] **Step A1.1: Escrever SQL**

```sql
-- supabase/migrations/20260427000008_notifications.sql

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tipo text not null,
  titulo text not null,
  mensagem text not null,
  link text,
  lida boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_user_unread
  on public.notifications(user_id, lida, created_at desc);

alter table public.notifications enable row level security;

create policy "users read own notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy "users mark own notifications as read"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Insert e delete não têm policy: feitos via service_role nas server actions.
```

- [ ] **Step A1.2: Aplicar a migration e commit**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento"
export SUPABASE_ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2)
npx supabase db push
```

Esperar: "Applying migration 20260427000008_notifications.sql..." sem erro.

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
git add supabase/migrations/20260427000008_notifications.sql
git commit -m "feat(db): notifications table with RLS"
```

---

### Task A2: Regenerar tipos do banco

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step A2.1: Regenerar**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento"
SUPABASE_PROJECT_ID=jelvhwbpipawghwufpbc npm run db:types
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
npm run typecheck
```

Esperar: typecheck passa, `Database["public"]["Tables"]["notifications"]` agora existe.

- [ ] **Step A2.2: Commit**

```bash
git add src/types/database.ts
git commit -m "chore(db): regenerate types after notifications migration"
```

---

## Bloco B — Backend (refactor + notificações)

### Task B1: Refactor `tarefas/schema.ts` (validações da spec)

**Files:**
- Modify: `src/lib/tarefas/schema.ts`
- Modify: `tests/unit/tarefas-schema.test.ts`

- [ ] **Step B1.1: Atualizar testes (TDD)**

Reescreva `tests/unit/tarefas-schema.test.ts` completamente:

```ts
import { describe, it, expect } from "vitest";
import { createTaskSchema, editTaskSchema } from "@/lib/tarefas/schema";

const VALID_UUID = "00000000-0000-0000-0000-000000000000";

describe("createTaskSchema", () => {
  it("aceita tarefa válida sem prazo", () => {
    const r = createTaskSchema.safeParse({
      titulo: "Revisar criativos",
      atribuido_a: VALID_UUID,
      prioridade: "alta",
    });
    expect(r.success).toBe(true);
  });

  it("aceita título com 2 chars", () => {
    const r = createTaskSchema.safeParse({
      titulo: "OK",
      atribuido_a: VALID_UUID,
    });
    expect(r.success).toBe(true);
  });

  it("rejeita título com 1 char", () => {
    expect(createTaskSchema.safeParse({
      titulo: "A",
      atribuido_a: VALID_UUID,
    }).success).toBe(false);
  });

  it("rejeita atribuido_a vazio", () => {
    expect(createTaskSchema.safeParse({
      titulo: "Revisar criativos",
      atribuido_a: "",
    }).success).toBe(false);
  });

  it("aceita prazo no futuro", () => {
    const futuro = new Date();
    futuro.setDate(futuro.getDate() + 1);
    const r = createTaskSchema.safeParse({
      titulo: "Revisar",
      atribuido_a: VALID_UUID,
      due_date: futuro.toISOString().slice(0, 10),
    });
    expect(r.success).toBe(true);
  });

  it("aceita prazo igual a hoje", () => {
    const hoje = new Date().toISOString().slice(0, 10);
    const r = createTaskSchema.safeParse({
      titulo: "Revisar",
      atribuido_a: VALID_UUID,
      due_date: hoje,
    });
    expect(r.success).toBe(true);
  });

  it("rejeita prazo no passado", () => {
    const passado = new Date();
    passado.setDate(passado.getDate() - 1);
    const r = createTaskSchema.safeParse({
      titulo: "Revisar",
      atribuido_a: VALID_UUID,
      due_date: passado.toISOString().slice(0, 10),
    });
    expect(r.success).toBe(false);
  });

  it("aceita prioridade default 'media'", () => {
    const r = createTaskSchema.safeParse({
      titulo: "Revisar",
      atribuido_a: VALID_UUID,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.prioridade).toBe("media");
  });
});

describe("editTaskSchema", () => {
  it("exige status válido", () => {
    const r = editTaskSchema.safeParse({
      id: VALID_UUID,
      titulo: "Revisar",
      atribuido_a: VALID_UUID,
      status: "invalido",
    });
    expect(r.success).toBe(false);
  });

  it("permite prazo no passado em edit (sem regra de futuro)", () => {
    const passado = new Date();
    passado.setDate(passado.getDate() - 5);
    const r = editTaskSchema.safeParse({
      id: VALID_UUID,
      titulo: "Revisar",
      atribuido_a: VALID_UUID,
      status: "aberta",
      due_date: passado.toISOString().slice(0, 10),
    });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step B1.2: Rodar test, esperar falhar**

```bash
npm run test -- tests/unit/tarefas-schema.test.ts
```

Esperar: testes "aceita título com 2 chars" e "rejeita prazo no passado" falham (porque schema atual exige título min 3 e não valida prazo).

- [ ] **Step B1.3: Atualizar `src/lib/tarefas/schema.ts`**

Substitua o conteúdo inteiro:

```ts
import { z } from "zod";

export const PRIORITIES = ["alta", "media", "baixa"] as const;
export const TASK_STATUSES = ["aberta", "em_andamento", "concluida"] as const;

const todayIso = () => new Date().toISOString().slice(0, 10);

export const createTaskSchema = z.object({
  titulo: z.string().min(2, "Título muito curto").max(200, "Título muito longo"),
  descricao: z.string().max(4000, "Descrição muito longa").optional().nullable(),
  prioridade: z.enum(PRIORITIES).default("media"),
  atribuido_a: z.string().uuid("Selecione um responsável"),
  client_id: z.string().uuid().optional().nullable(),
  due_date: z
    .string()
    .optional()
    .nullable()
    .refine(
      (v) => !v || v >= todayIso(),
      "Prazo não pode estar no passado",
    ),
});

export const editTaskSchema = z.object({
  id: z.string().uuid(),
  titulo: z.string().min(2, "Título muito curto").max(200, "Título muito longo"),
  descricao: z.string().max(4000, "Descrição muito longa").optional().nullable(),
  prioridade: z.enum(PRIORITIES).default("media"),
  atribuido_a: z.string().uuid("Selecione um responsável"),
  client_id: z.string().uuid().optional().nullable(),
  due_date: z.string().optional().nullable(), // sem restrição de futuro em edit
  status: z.enum(TASK_STATUSES),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type EditTaskInput = z.infer<typeof editTaskSchema>;
```

- [ ] **Step B1.4: Rodar test, esperar passar**

```bash
npm run test -- tests/unit/tarefas-schema.test.ts
```

Esperar: todos passam.

- [ ] **Step B1.5: Commit**

```bash
git add src/lib/tarefas/schema.ts tests/unit/tarefas-schema.test.ts
git commit -m "refactor(tarefas): align schema with spec (title min 2, prazo not in past)"
```

---

### Task B2: Refactor `tarefas/queries.ts` (sort + filtros + listTasksForClient)

**Files:**
- Modify: `src/lib/tarefas/queries.ts`
- Create: `tests/unit/tarefas-queries.test.ts`

- [ ] **Step B2.1: Escrever testes (TDD)**

Crie `tests/unit/tarefas-queries.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { sortTasks, filterTasksByPrazo } from "@/lib/tarefas/queries";

const baseTask = {
  id: "t",
  titulo: "x",
  prioridade: "media" as const,
  status: "aberta" as const,
  due_date: null as string | null,
  client_id: null,
  atribuido: null,
  criador: null,
  cliente: null,
};

describe("sortTasks", () => {
  it("ordena por prazo asc, nulls por último", () => {
    const tasks = [
      { ...baseTask, id: "a", due_date: null },
      { ...baseTask, id: "b", due_date: "2026-05-10" },
      { ...baseTask, id: "c", due_date: "2026-05-01" },
    ];
    const sorted = sortTasks(tasks);
    expect(sorted.map((t) => t.id)).toEqual(["c", "b", "a"]);
  });

  it("desempate: prioridade alta primeiro entre tarefas de mesmo prazo", () => {
    const tasks = [
      { ...baseTask, id: "a", due_date: "2026-05-10", prioridade: "baixa" as const },
      { ...baseTask, id: "b", due_date: "2026-05-10", prioridade: "alta" as const },
      { ...baseTask, id: "c", due_date: "2026-05-10", prioridade: "media" as const },
    ];
    const sorted = sortTasks(tasks);
    expect(sorted.map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("desempate em ambas tarefas sem prazo: prioridade alta primeiro", () => {
    const tasks = [
      { ...baseTask, id: "a", due_date: null, prioridade: "baixa" as const },
      { ...baseTask, id: "b", due_date: null, prioridade: "alta" as const },
    ];
    const sorted = sortTasks(tasks);
    expect(sorted.map((t) => t.id)).toEqual(["b", "a"]);
  });
});

describe("filterTasksByPrazo", () => {
  const today = new Date("2026-04-27T12:00:00Z");

  it("'hoje' inclui tarefa com prazo de hoje", () => {
    const tasks = [
      { ...baseTask, id: "a", due_date: "2026-04-27" },
      { ...baseTask, id: "b", due_date: "2026-04-28" },
    ];
    expect(filterTasksByPrazo(tasks, "hoje", today).map((t) => t.id)).toEqual(["a"]);
  });

  it("'semana' inclui tarefas até daqui a 7 dias", () => {
    const tasks = [
      { ...baseTask, id: "a", due_date: "2026-04-27" },
      { ...baseTask, id: "b", due_date: "2026-05-04" }, // 7 dias
      { ...baseTask, id: "c", due_date: "2026-05-05" }, // 8 dias - excluir
    ];
    const result = filterTasksByPrazo(tasks, "semana", today).map((t) => t.id);
    expect(result).toContain("a");
    expect(result).toContain("b");
    expect(result).not.toContain("c");
  });

  it("'vencidas' inclui prazo no passado, exclui sem prazo", () => {
    const tasks = [
      { ...baseTask, id: "a", due_date: "2026-04-26" },
      { ...baseTask, id: "b", due_date: "2026-04-27" },
      { ...baseTask, id: "c", due_date: null },
    ];
    expect(filterTasksByPrazo(tasks, "vencidas", today).map((t) => t.id)).toEqual(["a"]);
  });

  it("'sem_prazo' inclui apenas due_date null", () => {
    const tasks = [
      { ...baseTask, id: "a", due_date: null },
      { ...baseTask, id: "b", due_date: "2026-04-27" },
    ];
    expect(filterTasksByPrazo(tasks, "sem_prazo", today).map((t) => t.id)).toEqual(["a"]);
  });

  it("'qualquer' retorna todas", () => {
    const tasks = [
      { ...baseTask, id: "a", due_date: null },
      { ...baseTask, id: "b", due_date: "2026-01-01" },
      { ...baseTask, id: "c", due_date: "2099-12-31" },
    ];
    expect(filterTasksByPrazo(tasks, "qualquer", today)).toHaveLength(3);
  });
});
```

- [ ] **Step B2.2: Rodar test, esperar falhar**

```bash
npm run test -- tests/unit/tarefas-queries.test.ts
```

Esperar: falha porque `sortTasks` e `filterTasksByPrazo` ainda não existem.

- [ ] **Step B2.3: Atualizar `src/lib/tarefas/queries.ts`**

Substitua o conteúdo inteiro:

```ts
import { createClient } from "@/lib/supabase/server";

const PRIORITY_RANK: Record<string, number> = { alta: 0, media: 1, baixa: 2 };

export interface TaskRow {
  id: string;
  titulo: string;
  descricao?: string | null;
  prioridade: "alta" | "media" | "baixa";
  status: "aberta" | "em_andamento" | "concluida";
  due_date: string | null;
  created_at?: string;
  completed_at?: string | null;
  client_id: string | null;
  atribuido?: { id?: string; nome: string } | null;
  criador?: { id?: string; nome: string } | null;
  cliente?: { id: string; nome: string } | null;
  criado_por?: string;
  atribuido_a?: string;
}

export function sortTasks<T extends Pick<TaskRow, "due_date" | "prioridade">>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    if (a.due_date && b.due_date) {
      if (a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
    } else if (a.due_date && !b.due_date) {
      return -1;
    } else if (!a.due_date && b.due_date) {
      return 1;
    }
    return (PRIORITY_RANK[a.prioridade] ?? 99) - (PRIORITY_RANK[b.prioridade] ?? 99);
  });
}

export type PrazoFilter = "hoje" | "semana" | "vencidas" | "sem_prazo" | "qualquer";

export function filterTasksByPrazo<T extends { due_date: string | null }>(
  tasks: T[],
  prazo: PrazoFilter,
  today: Date = new Date(),
): T[] {
  const todayIso = today.toISOString().slice(0, 10);
  const in7 = new Date(today);
  in7.setDate(in7.getDate() + 7);
  const in7Iso = in7.toISOString().slice(0, 10);

  return tasks.filter((t) => {
    switch (prazo) {
      case "hoje":
        return t.due_date === todayIso;
      case "semana":
        return t.due_date !== null && t.due_date >= todayIso && t.due_date <= in7Iso;
      case "vencidas":
        return t.due_date !== null && t.due_date < todayIso;
      case "sem_prazo":
        return t.due_date === null;
      case "qualquer":
      default:
        return true;
    }
  });
}

export interface TaskFilters {
  status?: ("aberta" | "em_andamento" | "concluida")[];
  atribuidoA?: string;
  criadoPor?: string;
  clientId?: string;
  prioridade?: ("alta" | "media" | "baixa")[];
}

export async function listTasks(filters?: TaskFilters): Promise<TaskRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("tasks")
    .select(`
      id, titulo, descricao, prioridade, status, due_date, created_at, completed_at, client_id, criado_por, atribuido_a,
      atribuido:profiles!tasks_atribuido_a_fkey(id, nome),
      criador:profiles!tasks_criado_por_fkey(id, nome),
      cliente:clients(id, nome)
    `);

  if (filters?.status && filters.status.length > 0) query = query.in("status", filters.status);
  if (filters?.prioridade && filters.prioridade.length > 0) query = query.in("prioridade", filters.prioridade);
  if (filters?.atribuidoA) query = query.eq("atribuido_a", filters.atribuidoA);
  if (filters?.criadoPor) query = query.eq("criado_por", filters.criadoPor);
  if (filters?.clientId) query = query.eq("client_id", filters.clientId);

  const { data, error } = await query;
  if (error) throw error;
  return sortTasks((data ?? []) as TaskRow[]);
}

export async function listTasksForClient(clientId: string): Promise<TaskRow[]> {
  return listTasks({ clientId });
}

export async function getTaskById(id: string): Promise<TaskRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      *,
      atribuido:profiles!tasks_atribuido_a_fkey(id, nome),
      criador:profiles!tasks_criado_por_fkey(id, nome),
      cliente:clients(id, nome)
    `)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as TaskRow;
}

export async function countOpenTasksForUser(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("atribuido_a", userId)
    .neq("status", "concluida");
  return count ?? 0;
}

export async function countOverdueTasksForUser(userId: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const supabase = await createClient();
  const { count } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("atribuido_a", userId)
    .neq("status", "concluida")
    .lt("due_date", today);
  return count ?? 0;
}
```

- [ ] **Step B2.4: Rodar test e typecheck**

```bash
npm run test -- tests/unit/tarefas-queries.test.ts
npm run typecheck
```

Esperar: todos os testes passam, typecheck OK.

- [ ] **Step B2.5: Commit**

```bash
git add src/lib/tarefas/queries.ts tests/unit/tarefas-queries.test.ts
git commit -m "refactor(tarefas): sort by due_date asc nulls last, then priority; rich filters"
```

---

### Task B3: Módulo `notificacoes` (schema + queries + actions + trigger)

**Files:**
- Create: `src/lib/notificacoes/schema.ts`
- Create: `src/lib/notificacoes/queries.ts`
- Create: `src/lib/notificacoes/actions.ts`
- Create: `src/lib/notificacoes/trigger.ts`
- Create: `tests/unit/notificacoes-trigger.test.ts`

- [ ] **Step B3.1: Escrever teste de idempotência (TDD)**

Crie `tests/unit/notificacoes-trigger.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { shouldNotify } from "@/lib/notificacoes/trigger";

describe("shouldNotify", () => {
  it("retorna false quando recipiente == origem (idempotência)", () => {
    expect(shouldNotify("user-1", "user-1")).toBe(false);
  });

  it("retorna true quando recipiente != origem", () => {
    expect(shouldNotify("user-1", "user-2")).toBe(true);
  });
});
```

- [ ] **Step B3.2: Rodar test, esperar falhar**

```bash
npm run test -- tests/unit/notificacoes-trigger.test.ts
```

Esperar: import falha porque `trigger.ts` não existe ainda.

- [ ] **Step B3.3: Criar `src/lib/notificacoes/schema.ts`**

```ts
import { z } from "zod";

export const NOTIFICATION_TYPES = [
  "task_assigned",
  "task_completed",
] as const;

export type NotificationType = typeof NOTIFICATION_TYPES[number];

export const markReadSchema = z.object({
  id: z.string().uuid(),
});

export interface Notification {
  id: string;
  user_id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  link: string | null;
  lida: boolean;
  created_at: string;
}
```

- [ ] **Step B3.4: Criar `src/lib/notificacoes/queries.ts`**

```ts
import { createClient } from "@/lib/supabase/server";
import type { Notification } from "./schema";

export async function listMyNotifications(limit: number = 50): Promise<Notification[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, user_id, tipo, titulo, mensagem, link, lida, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Notification[];
}

export async function countMyUnread(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("lida", false);
  return count ?? 0;
}
```

- [ ] **Step B3.5: Criar `src/lib/notificacoes/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { listMyNotifications, countMyUnread } from "./queries";
import { markReadSchema } from "./schema";

export async function markNotificationReadAction(formData: FormData) {
  await requireAuth();
  const parsed = markReadSchema.safeParse({ id: String(formData.get("id") ?? "") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ lida: true })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath("/notificacoes");
  return { success: true };
}

export async function markAllNotificationsReadAction() {
  const actor = await requireAuth();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ lida: true })
    .eq("user_id", actor.id)
    .eq("lida", false);
  if (error) return { error: error.message };

  revalidatePath("/notificacoes");
  return { success: true };
}

export async function getMyNotificationsAction() {
  await requireAuth();
  const [items, unread] = await Promise.all([listMyNotifications(10), countMyUnread()]);
  return { items, unread };
}
```

- [ ] **Step B3.6: Criar `src/lib/notificacoes/trigger.ts`**

```ts
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { NotificationType } from "./schema";
import type { Database } from "@/types/database";

export function shouldNotify(recipientId: string, sourceId: string): boolean {
  return recipientId !== sourceId;
}

interface NotifyArgs {
  recipientId: string;
  sourceId: string;
  tipo: NotificationType;
  titulo: string;
  mensagem: string;
  link?: string;
}

async function notify({ recipientId, sourceId, tipo, titulo, mensagem, link }: NotifyArgs): Promise<void> {
  if (!shouldNotify(recipientId, sourceId)) return;

  const supabase = createServiceRoleClient();
  const insert: Database["public"]["Tables"]["notifications"]["Insert"] = {
    user_id: recipientId,
    tipo,
    titulo,
    mensagem,
    link: link ?? null,
  };
  await supabase.from("notifications").insert(insert);
}

export async function notifyTaskAssigned(args: {
  taskId: string;
  assigneeId: string;
  creatorId: string;
  taskTitle: string;
  creatorName: string;
}): Promise<void> {
  await notify({
    recipientId: args.assigneeId,
    sourceId: args.creatorId,
    tipo: "task_assigned",
    titulo: "Nova tarefa atribuída a você",
    mensagem: `${args.creatorName} atribuiu: "${args.taskTitle}"`,
    link: `/tarefas/${args.taskId}`,
  });
}

export async function notifyTaskCompleted(args: {
  taskId: string;
  completerId: string;
  creatorId: string;
  taskTitle: string;
  completerName: string;
}): Promise<void> {
  await notify({
    recipientId: args.creatorId,
    sourceId: args.completerId,
    tipo: "task_completed",
    titulo: "Tarefa concluída",
    mensagem: `${args.completerName} concluiu: "${args.taskTitle}"`,
    link: `/tarefas/${args.taskId}`,
  });
}
```

- [ ] **Step B3.7: Rodar test, esperar passar**

```bash
npm run test -- tests/unit/notificacoes-trigger.test.ts
npm run typecheck
```

Esperar: todos passam.

- [ ] **Step B3.8: Commit**

```bash
git add src/lib/notificacoes/ tests/unit/notificacoes-trigger.test.ts
git commit -m "feat(notificacoes): module with schema, queries, actions and trigger helpers"
```

---

### Task B4: Refactor `tarefas/actions.ts` (audit + ADM/Sócio + delete + triggers)

**Files:**
- Modify: `src/lib/tarefas/actions.ts`

- [ ] **Step B4.1: Substituir conteúdo inteiro**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, type CurrentUser } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { notifyTaskAssigned, notifyTaskCompleted } from "@/lib/notificacoes/trigger";
import { createTaskSchema, editTaskSchema } from "./schema";

function fd(formData: FormData, key: string) {
  const v = formData.get(key);
  return v === null || v === "" ? undefined : String(v);
}

function isPrivileged(user: CurrentUser): boolean {
  return user.role === "adm" || user.role === "socio";
}

async function getProfileNameAndActive(supabase: Awaited<ReturnType<typeof createClient>>, profileId: string) {
  const { data } = await supabase.from("profiles").select("nome, ativo").eq("id", profileId).single();
  return data ?? null;
}

export async function createTaskAction(formData: FormData) {
  const actor = await requireAuth();

  const parsed = createTaskSchema.safeParse({
    titulo: fd(formData, "titulo"),
    descricao: fd(formData, "descricao"),
    prioridade: fd(formData, "prioridade") || "media",
    atribuido_a: fd(formData, "atribuido_a"),
    client_id: fd(formData, "client_id"),
    due_date: fd(formData, "due_date"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  const assignee = await getProfileNameAndActive(supabase, parsed.data.atribuido_a);
  if (!assignee || !assignee.ativo) return { error: "Responsável inválido ou desativado" };

  const insertPayload = {
    titulo: parsed.data.titulo,
    descricao: parsed.data.descricao || null,
    prioridade: parsed.data.prioridade,
    atribuido_a: parsed.data.atribuido_a,
    client_id: parsed.data.client_id || null,
    due_date: parsed.data.due_date || null,
    criado_por: actor.id,
  };

  const { data: created, error } = await supabase
    .from("tasks")
    .insert(insertPayload)
    .select("id, client_id, titulo")
    .single();

  if (error || !created) return { error: error?.message ?? "Falha ao criar tarefa" };

  await logAudit({
    entidade: "tasks",
    entidade_id: created.id,
    acao: "create",
    dados_depois: insertPayload as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  await notifyTaskAssigned({
    taskId: created.id,
    assigneeId: parsed.data.atribuido_a,
    creatorId: actor.id,
    taskTitle: created.titulo,
    creatorName: actor.nome,
  });

  revalidatePath("/tarefas");
  if (created.client_id) revalidatePath(`/clientes/${created.client_id}/tarefas`);
  redirect(`/tarefas/${created.id}`);
}

export async function updateTaskAction(formData: FormData) {
  const actor = await requireAuth();

  const parsed = editTaskSchema.safeParse({
    id: fd(formData, "id"),
    titulo: fd(formData, "titulo"),
    descricao: fd(formData, "descricao"),
    prioridade: fd(formData, "prioridade") || "media",
    atribuido_a: fd(formData, "atribuido_a"),
    client_id: fd(formData, "client_id"),
    due_date: fd(formData, "due_date"),
    status: fd(formData, "status") || "aberta",
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: before } = await supabase.from("tasks").select("*").eq("id", parsed.data.id).single();
  if (!before) return { error: "Tarefa não encontrada" };

  const canEdit =
    before.criado_por === actor.id ||
    before.atribuido_a === actor.id ||
    isPrivileged(actor);
  if (!canEdit) return { error: "Sem permissão" };

  const assignee = await getProfileNameAndActive(supabase, parsed.data.atribuido_a);
  if (!assignee || !assignee.ativo) return { error: "Responsável inválido ou desativado" };

  const completed_at =
    parsed.data.status === "concluida" && before.status !== "concluida"
      ? new Date().toISOString()
      : parsed.data.status !== "concluida"
        ? null
        : before.completed_at;

  const updatePayload = {
    titulo: parsed.data.titulo,
    descricao: parsed.data.descricao || null,
    prioridade: parsed.data.prioridade,
    atribuido_a: parsed.data.atribuido_a,
    client_id: parsed.data.client_id || null,
    due_date: parsed.data.due_date || null,
    status: parsed.data.status,
    completed_at,
  };

  const { error } = await supabase.from("tasks").update(updatePayload).eq("id", parsed.data.id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "tasks",
    entidade_id: parsed.data.id,
    acao: "update",
    dados_antes: before as unknown as Record<string, unknown>,
    dados_depois: updatePayload as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  if (parsed.data.atribuido_a !== before.atribuido_a) {
    await notifyTaskAssigned({
      taskId: parsed.data.id,
      assigneeId: parsed.data.atribuido_a,
      creatorId: actor.id,
      taskTitle: parsed.data.titulo,
      creatorName: actor.nome,
    });
  }

  if (parsed.data.status === "concluida" && before.status !== "concluida") {
    await notifyTaskCompleted({
      taskId: parsed.data.id,
      completerId: actor.id,
      creatorId: before.criado_por,
      taskTitle: parsed.data.titulo,
      completerName: actor.nome,
    });
  }

  revalidatePath("/tarefas");
  revalidatePath(`/tarefas/${parsed.data.id}`);
  if (before.client_id) revalidatePath(`/clientes/${before.client_id}/tarefas`);
  if (parsed.data.client_id && parsed.data.client_id !== before.client_id) {
    revalidatePath(`/clientes/${parsed.data.client_id}/tarefas`);
  }
  redirect(`/tarefas/${parsed.data.id}`);
}

export async function toggleTaskCompletionAction(taskId: string) {
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
  const completed_at = novoStatus === "concluida" ? new Date().toISOString() : null;

  const { error } = await supabase
    .from("tasks")
    .update({ status: novoStatus, completed_at })
    .eq("id", taskId);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "tasks",
    entidade_id: taskId,
    acao: "update",
    dados_antes: { status: t.status, completed_at: t.completed_at } as Record<string, unknown>,
    dados_depois: { status: novoStatus, completed_at } as Record<string, unknown>,
    ator_id: actor.id,
  });

  if (novoStatus === "concluida") {
    await notifyTaskCompleted({
      taskId,
      completerId: actor.id,
      creatorId: t.criado_por,
      taskTitle: t.titulo,
      completerName: actor.nome,
    });
  }

  revalidatePath("/tarefas");
  revalidatePath(`/tarefas/${taskId}`);
  if (t.client_id) revalidatePath(`/clientes/${t.client_id}/tarefas`);
  return { success: novoStatus === "concluida" ? "Tarefa concluída" : "Tarefa reaberta" };
}

export async function deleteTaskAction(taskId: string) {
  const actor = await requireAuth();
  const supabase = await createClient();
  const { data: t } = await supabase.from("tasks").select("*").eq("id", taskId).single();
  if (!t) return { error: "Tarefa não encontrada" };

  const canDelete = t.criado_por === actor.id || isPrivileged(actor);
  if (!canDelete) return { error: "Sem permissão" };

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "tasks",
    entidade_id: taskId,
    acao: "soft_delete",
    dados_antes: t as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  revalidatePath("/tarefas");
  if (t.client_id) revalidatePath(`/clientes/${t.client_id}/tarefas`);
  redirect("/tarefas");
}
```

- [ ] **Step B4.2: Typecheck e build**

```bash
npm run typecheck
npm run build
```

Esperar: typecheck OK. Build pode falhar nas env vars (esperado fora do Vercel) — checar que falhou só por env e não por type/compile error.

- [ ] **Step B4.3: Commit**

```bash
git add src/lib/tarefas/actions.ts
git commit -m "refactor(tarefas): audit log, ADM/Sócio override, delete action and notification triggers"
```

---

## Bloco C — UI (notificações + filtros + integração na pasta cliente)

### Task C1: NotificationBell + montar no TopBar

**Files:**
- Create: `src/components/notificacoes/NotificationBell.tsx`
- Create: `src/components/notificacoes/NotificationItem.tsx`
- Modify: `src/components/layout/TopBar.tsx`

- [ ] **Step C1.1: Criar `NotificationItem.tsx`**

```tsx
"use client";

import Link from "next/link";
import { markNotificationReadAction } from "@/lib/notificacoes/actions";

interface Props {
  id: string;
  titulo: string;
  mensagem: string;
  link: string | null;
  lida: boolean;
  created_at: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function NotificationItem({ id, titulo, mensagem, link, lida, created_at }: Props) {
  async function markRead() {
    if (lida) return;
    const fd = new FormData();
    fd.set("id", id);
    await markNotificationReadAction(fd);
  }

  const content = (
    <div className={`flex items-start gap-2 rounded-md p-2 ${lida ? "" : "bg-primary/5"}`}>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{titulo}</div>
        <div className="text-[11px] text-muted-foreground line-clamp-2">{mensagem}</div>
      </div>
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{timeAgo(created_at)}</span>
    </div>
  );

  if (link) {
    return (
      <Link href={link} onClick={markRead} className="block">
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={markRead} className="block w-full text-left">
      {content}
    </button>
  );
}
```

- [ ] **Step C1.2: Criar `NotificationBell.tsx`**

```tsx
"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationItem } from "./NotificationItem";
import { getMyNotificationsAction, markAllNotificationsReadAction } from "@/lib/notificacoes/actions";

interface Item {
  id: string;
  titulo: string;
  mensagem: string;
  link: string | null;
  lida: boolean;
  created_at: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  async function fetchData() {
    try {
      const data = await getMyNotificationsAction();
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      // silencioso — falha de fetch não deve quebrar UI
    }
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    const onFocus = () => fetchData();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function handleMarkAll() {
    await markAllNotificationsReadAction();
    await fetchData();
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Notificações"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border bg-popover p-2 shadow-lg">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-xs font-semibold">Notificações</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-[11px] text-primary hover:underline"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="mt-2 max-h-80 space-y-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">Sem notificações</div>
            ) : (
              items.map((it) => (
                <NotificationItem key={it.id} {...it} />
              ))
            )}
          </div>

          <div className="border-t pt-2">
            <Link
              href="/notificacoes"
              onClick={() => setOpen(false)}
              className="block text-center text-[11px] text-primary hover:underline"
            >
              Ver todas
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step C1.3: Atualizar `src/components/layout/TopBar.tsx`**

Substituir conteúdo inteiro:

```tsx
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { NotificationBell } from "@/components/notificacoes/NotificationBell";

export function TopBar({ nome, email }: { nome: string; email: string }) {
  return (
    <header className="flex h-14 items-center justify-end gap-2 border-b bg-card px-6">
      <NotificationBell />
      <ThemeToggle />
      <UserMenu nome={nome} email={email} />
    </header>
  );
}
```

- [ ] **Step C1.4: Typecheck e build**

```bash
npm run typecheck
```

Esperar: OK.

- [ ] **Step C1.5: Commit**

```bash
git add src/components/notificacoes/ src/components/layout/TopBar.tsx
git commit -m "feat(notificacoes): NotificationBell with polling and TopBar mount"
```

---

### Task C2: Página `/notificacoes`

**Files:**
- Create: `src/app/(authed)/notificacoes/page.tsx`

- [ ] **Step C2.1: Criar página**

```tsx
import { requireAuth } from "@/lib/auth/session";
import { listMyNotifications } from "@/lib/notificacoes/queries";
import { markAllNotificationsReadAction } from "@/lib/notificacoes/actions";
import { NotificationItem } from "@/components/notificacoes/NotificationItem";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function NotificacoesPage() {
  await requireAuth();
  const items = await listMyNotifications(100);

  async function markAll() {
    "use server";
    await markAllNotificationsReadAction();
  }

  const unreadCount = items.filter((i) => !i.lida).length;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notificações</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} no total · {unreadCount} não lidas
          </p>
        </div>
        {unreadCount > 0 && (
          <form action={markAll}>
            <Button type="submit" variant="outline" size="sm">
              Marcar todas como lidas
            </Button>
          </form>
        )}
      </header>

      {items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Você não tem notificações.
        </Card>
      ) : (
        <Card className="divide-y p-2">
          {items.map((it) => (
            <NotificationItem key={it.id} {...it} />
          ))}
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step C2.2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step C2.3: Commit**

```bash
git add "src/app/(authed)/notificacoes/"
git commit -m "feat(notificacoes): /notificacoes page with mark-all-read"
```

---

### Task C3: Página `/clientes/[id]/tarefas`

**Files:**
- Create: `src/app/(authed)/clientes/[id]/tarefas/page.tsx`

(O item "Tarefas" já existe em `src/components/clientes/ClienteSidebar.tsx` — apontando para essa rota. Só precisa criar a página.)

- [ ] **Step C3.1: Criar página**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listTasksForClient } from "@/lib/tarefas/queries";
import { TasksList } from "@/components/tarefas/TasksList";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function ClienteTarefasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAuth();

  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, nome")
    .eq("id", id)
    .single();
  if (!client) notFound();

  const tasks = await listTasksForClient(id);
  const abertas = tasks.filter((t) => t.status !== "concluida");
  const concluidas = tasks.filter((t) => t.status === "concluida");

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Tarefas</h2>
          <p className="text-sm text-muted-foreground">
            {abertas.length} em aberto · {concluidas.length} concluídas
          </p>
        </div>
        <Link href={`/tarefas/nova?client_id=${id}`}>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />Nova tarefa
          </Button>
        </Link>
      </header>

      {abertas.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Em aberto</h3>
          <TasksList tasks={abertas} />
        </section>
      )}

      {concluidas.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Concluídas</h3>
          <TasksList tasks={concluidas} />
        </section>
      )}

      {tasks.length === 0 && (
        <p className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
          Sem tarefas vinculadas a este cliente.
        </p>
      )}
    </div>
  );
}
```

**Nota:** A página de criação `/tarefas/nova` já aceita `?client_id=<id>` via `searchParams` e pré-popula o cliente.

- [ ] **Step C3.2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step C3.3: Commit**

```bash
git add "src/app/(authed)/clientes/[id]/tarefas/"
git commit -m "feat(tarefas): client folder tab listing tasks linked to the client"
```

---

### Task C4: TaskFilters + refactor `/tarefas/page.tsx`

**Files:**
- Create: `src/components/tarefas/TaskFilters.tsx`
- Modify: `src/app/(authed)/tarefas/page.tsx`

- [ ] **Step C4.1: Criar `TaskFilters.tsx`**

```tsx
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

  const status = params.get("status") ?? "abertas";
  const prioridade = params.get("prioridade") ?? "qualquer";
  const prazo = params.get("prazo") ?? "qualquer";
  const clientId = params.get("client") ?? "qualquer";
  const atribuido = params.get("atribuido") ?? "qualquer";

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
      <div className="space-y-1">
        <Label className="text-[11px]">Status</Label>
        <Select value={status} onValueChange={(v) => setParam("status", v)}>
          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="abertas">Abertas</SelectItem>
            <SelectItem value="em_andamento">Em andamento</SelectItem>
            <SelectItem value="concluida">Concluídas</SelectItem>
            <SelectItem value="todas">Todas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">Prioridade</Label>
        <Select value={prioridade} onValueChange={(v) => setParam("prioridade", v)}>
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
        <Label className="text-[11px]">Prazo</Label>
        <Select value={prazo} onValueChange={(v) => setParam("prazo", v)}>
          <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="qualquer">Qualquer</SelectItem>
            <SelectItem value="hoje">Hoje</SelectItem>
            <SelectItem value="semana">Esta semana</SelectItem>
            <SelectItem value="vencidas">Vencidas</SelectItem>
            <SelectItem value="sem_prazo">Sem prazo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">Cliente</Label>
        <Select value={clientId} onValueChange={(v) => setParam("client", v)}>
          <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="qualquer">Qualquer</SelectItem>
            {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {showAtribuido && (
        <div className="space-y-1">
          <Label className="text-[11px]">Atribuído</Label>
          <Select value={atribuido} onValueChange={(v) => setParam("atribuido", v)}>
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

- [ ] **Step C4.2: Refatorar `src/app/(authed)/tarefas/page.tsx`**

Substituir conteúdo inteiro:

```tsx
import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listTasks, filterTasksByPrazo, type PrazoFilter, type TaskFilters as TaskFiltersData } from "@/lib/tarefas/queries";
import { TasksList } from "@/components/tarefas/TasksList";
import { TaskFilters } from "@/components/tarefas/TaskFilters";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

type Aba = "minhas" | "criadas" | "todas";

const PRAZO_VALUES: PrazoFilter[] = ["hoje", "semana", "vencidas", "sem_prazo", "qualquer"];

function parsePrazo(v: string | undefined): PrazoFilter {
  return PRAZO_VALUES.includes(v as PrazoFilter) ? (v as PrazoFilter) : "qualquer";
}

interface SearchParams {
  aba?: string;
  status?: string;
  prioridade?: string;
  prazo?: string;
  client?: string;
  atribuido?: string;
}

export default async function TarefasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireAuth();

  const aba: Aba =
    params.aba === "criadas" ? "criadas" : params.aba === "todas" ? "todas" : "minhas";

  const filters: TaskFiltersData = {};
  if (params.prioridade && params.prioridade !== "qualquer") {
    filters.prioridade = [params.prioridade as "alta" | "media" | "baixa"];
  }
  if (params.client && params.client !== "qualquer") filters.clientId = params.client;

  if (params.status === "em_andamento") filters.status = ["em_andamento"];
  else if (params.status === "concluida") filters.status = ["concluida"];
  else if (params.status === "todas") filters.status = undefined;
  else filters.status = ["aberta", "em_andamento"]; // 'abertas' default

  if (aba === "minhas") filters.atribuidoA = user.id;
  else if (aba === "criadas") filters.criadoPor = user.id;
  else if (aba === "todas" && params.atribuido && params.atribuido !== "qualquer") {
    filters.atribuidoA = params.atribuido;
  }

  let tasks = await listTasks(filters);
  tasks = filterTasksByPrazo(tasks, parsePrazo(params.prazo));

  const supabase = await createClient();
  const [{ data: profiles = [] }, { data: clientes = [] }] = await Promise.all([
    supabase.from("profiles").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("clients").select("id, nome").eq("status", "ativo").order("nome"),
  ]);

  function tabHref(slug: Aba) {
    const sp = new URLSearchParams();
    if (slug !== "minhas") sp.set("aba", slug);
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

      <TaskFilters
        profiles={(profiles ?? []) as { id: string; nome: string }[]}
        clientes={(clientes ?? []) as { id: string; nome: string }[]}
        showAtribuido={aba === "todas"}
      />

      <TasksList tasks={tasks} />
    </div>
  );
}
```

- [ ] **Step C4.3: Build + typecheck**

```bash
npm run typecheck
```

Esperar: OK.

- [ ] **Step C4.4: Commit**

```bash
git add src/components/tarefas/TaskFilters.tsx "src/app/(authed)/tarefas/page.tsx"
git commit -m "feat(tarefas): rich filters (status, priority, prazo, cliente, atribuido)"
```

---

## Bloco D — Tests E2E + push final

### Task D1: Tests e2e

**Files:**
- Create: `tests/e2e/tarefas.spec.ts`

- [ ] **Step D1.1: Criar test**

```ts
import { test, expect } from "@playwright/test";

test("rota /tarefas redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/tarefas");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /tarefas/nova redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/tarefas/nova");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /notificacoes redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/notificacoes");
  await expect(page).toHaveURL(/\/login/);
});
```

- [ ] **Step D1.2: Rodar teste e build**

```bash
npm run test
npm run typecheck
```

Esperar: testes unit + e2e passam, typecheck OK.

(Não rodar `npm run build` localmente porque falha em env vars — confiar no Vercel.)

- [ ] **Step D1.3: Commit**

```bash
git add tests/e2e/tarefas.spec.ts
git commit -m "test(e2e): tarefas + notificacoes auth-redirect tests"
```

---

### Task D2: Push e abrir PR

- [ ] **Step D2.1: Push para a branch**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
git push origin claude/frosty-jang-a815ff
```

- [ ] **Step D2.2: Abrir PR de Fase 4 → main**

```bash
/opt/homebrew/bin/gh pr create --base main --head claude/frosty-jang-a815ff \
  --title "feat: Fase 4 — Tarefas (audit, ADM/Sócio, delete, notificações in-app, filtros, aba do cliente)" \
  --body "Implementa Fase 4 conforme spec docs/superpowers/specs/2026-04-27-fase-4-tarefas-design.md"
```

- [ ] **Step D2.3: Verificar Production deploy**

Esperar build do Vercel passar. Se passar, mergear o PR. Se falhar, ler o log com:

```bash
/opt/homebrew/bin/gh api repos/time-yide/yide-acompanha/deployments --jq '.[0] | .id' \
  | xargs -I {} /opt/homebrew/bin/gh api repos/time-yide/yide-acompanha/deployments/{}/statuses
```

---

## Self-Review

### Cobertura do spec — seção 5.5

| Spec | Coberto por |
|---|---|
| Tipo Trello/Asana simplificado | Já existe (TasksList, TaskForm) + refactor das actions |
| Listas: "Atribuídas a mim", "Criadas por mim", "Por cliente", "Por prioridade" | Task C4 (abas) + Task C3 (`/clientes/[id]/tarefas`) + filtro de prioridade no `TaskFilters` |
| Filtros: status, prioridade, prazo, cliente | Task C4 (`TaskFilters`) + Task B2 (`filterTasksByPrazo`) |
| Notificação ao ser atribuído | Task B3 (`notifyTaskAssigned`) + Task B4 (hook em createTask/updateTask) |
| Notificação ao ser concluída | Task B3 (`notifyTaskCompleted`) + Task B4 |
| Vincular tarefa a cliente (opcional) | Já existe |
| Aparece dentro da pasta do cliente | Task C3 |
| Audit log nas mudanças críticas | Task B4 (logAudit em create/update/toggle/delete) |
| Permissão ADM/Sócio editar/excluir | Task B4 (`isPrivileged()` check) |
| Title min 2 chars | Task B1 (schema refactor) |
| Prazo não no passado em criação | Task B1 |
| Sort: prazo asc nulls last → prioridade asc (alta primeiro) | Task B2 (`sortTasks`) |

### Lacunas conhecidas (intencionais — Fase 5)

- Notificação 24h antes do prazo (cron) → Fase 5
- Notificação overdue (cron) → Fase 5
- Email das notificações (Resend) → Fase 5
- Notificações de outros eventos (kanban, satisfação, comissão, calendário) → Fase 5
- Configuração de destinatários (`notification_rules`) → Fase 5

---

## Resumo da entrega

Após executar:

- Tabela `notifications` com RLS por usuário
- Audit log em todas as operações de tarefa
- Permissão de ADM/Sócio editar/excluir tarefas (mesmo de outros)
- Action `deleteTask` (com permissão correta)
- Validações: título min 2, prazo não no passado em criação, atribuído deve estar `ativo=true`
- Sort: prazo asc nulls last → prioridade asc
- Filtros ricos: status (4 opções incl. "todas"), prioridade, prazo (5 opções), cliente, atribuído
- 3 abas: "Atribuídas a mim" / "Criadas por mim" / "Todas"
- Sininho no header com badge de não lidas, dropdown com últimas 10, polling 60s + on focus
- Página `/notificacoes` com lista completa + "marcar todas como lidas"
- Aba "Tarefas" dentro da pasta do cliente
- Triggers de notificação: tarefa atribuída a mim, tarefa minha foi concluída
- Idempotência: não notifica quando atribuído == criador (ou concluinte == criador)
- Tests: schema (8 cases), queries (5 cases), trigger (2 cases), e2e (3 rotas)

Total: **~11 commits** (A1, A2, B1, B2, B3, B4, C1, C2, C3, C4, D1).
