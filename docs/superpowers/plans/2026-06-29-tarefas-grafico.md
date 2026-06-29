# Tarefas — Visão Gráfico — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Adicionar uma visão "Gráfico" (force-directed, estilo Obsidian) às Tarefas, com clientes e pessoas como hubs e tarefas orbitando, clicável e filtrável.

**Architecture:** Função pura `buildTaskGraph` (testável) monta nós/arestas dos dados já buscados na página → componente client `TasksGraph` renderiza com `react-force-graph-2d` (dynamic import, ssr:false) → wiring no ViewToggle + page (novo `?view=grafico`). Sem mudança no banco.

**Tech Stack:** Next 16 / React 19, `react-force-graph-2d`, vitest, Tailwind/lucide.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/tarefas/graph.ts` (novo) | `buildTaskGraph(tasks, profiles, clientes)` → `{nodes, links}`. Puro. |
| `tests/unit/tarefas-graph.test.ts` (novo) | Testa montagem do grafo. |
| `src/components/tarefas/TasksGraph.tsx` (novo) | Componente client: render force-graph + filtros + legenda. |
| `package.json` (modificar) | + `react-force-graph-2d`. |
| `src/components/tarefas/ViewToggle.tsx` (modificar) | + botão "Gráfico" (`?view=grafico`). |
| `src/app/(authed)/tarefas/page.tsx` (modificar) | Aceitar `view=grafico` + render `<TasksGraph>`. |

---

## Task 1: `buildTaskGraph` (puro) + teste

**Files:**
- Create: `src/lib/tarefas/graph.ts`
- Test: `tests/unit/tarefas-graph.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/tarefas-graph.test.ts
import { describe, it, expect } from "vitest";
import { buildTaskGraph, type GraphTask } from "@/lib/tarefas/graph";

const profiles = [{ id: "p1", nome: "Maria" }, { id: "p2", nome: "João" }];
const clientes = [{ id: "c1", nome: "Loja X" }, { id: "c2", nome: "Bar Y" }];

const tasks: GraphTask[] = [
  { id: "t1", titulo: "Arte feed", status: "aberta", prioridade: "alta", client_id: "c1", atribuido_a: "p1", participantes_ids: ["p2"] },
  { id: "t2", titulo: "Roteiro", status: "concluida", prioridade: "media", client_id: "c1", atribuido_a: "p2", participantes_ids: [] },
  { id: "t3", titulo: "Sem cliente", status: "aberta", prioridade: "baixa", client_id: null, atribuido_a: "p1", participantes_ids: [] },
];

describe("buildTaskGraph", () => {
  const { nodes, links } = buildTaskGraph(tasks, profiles, clientes);

  it("cria um nó por tarefa", () => {
    expect(nodes.filter((n) => n.type === "task")).toHaveLength(3);
  });

  it("cria hub de cliente só pros clientes usados (c1), não c2", () => {
    const cli = nodes.filter((n) => n.type === "cliente");
    expect(cli.map((n) => n.id)).toEqual(["cliente:c1"]);
    expect(cli[0].label).toBe("Loja X");
  });

  it("cria hub de pessoa pros envolvidos (p1, p2)", () => {
    const pes = nodes.filter((n) => n.type === "pessoa").map((n) => n.id).sort();
    expect(pes).toEqual(["pessoa:p1", "pessoa:p2"]);
  });

  it("liga tarefa ao cliente, responsável e participante", () => {
    const l1 = links.filter((l) => l.source === "task:t1");
    expect(l1.map((l) => l.target).sort()).toEqual(["cliente:c1", "pessoa:p1", "pessoa:p2"]);
  });

  it("tarefa sem cliente não cria link de cliente", () => {
    const l3 = links.filter((l) => l.source === "task:t3");
    expect(l3.map((l) => l.target)).toEqual(["pessoa:p1"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/tarefas-graph.test.ts`
Expected: FAIL — cannot find module `@/lib/tarefas/graph`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/tarefas/graph.ts

export interface GraphTask {
  id: string;
  titulo: string;
  status: string;
  prioridade: string;
  client_id: string | null;
  atribuido_a?: string | null;
  participantes_ids?: string[];
}

export type NodeType = "task" | "cliente" | "pessoa";

export interface GraphNode {
  id: string;          // "task:..", "cliente:..", "pessoa:.."
  type: NodeType;
  label: string;       // título da tarefa ou nome do hub
  taskId?: string;     // só pra type==='task'
  status?: string;     // só task
  prioridade?: string; // só task
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface TaskGraph {
  nodes: GraphNode[];
  links: GraphLink[];
}

/**
 * Monta o grafo: tarefas como nós, clientes e pessoas como hubs.
 * Hubs só entram se tiverem ao menos 1 tarefa ligada.
 */
export function buildTaskGraph(
  tasks: GraphTask[],
  profiles: Array<{ id: string; nome: string }>,
  clientes: Array<{ id: string; nome: string }>,
): TaskGraph {
  const nomePessoa = new Map(profiles.map((p) => [p.id, p.nome]));
  const nomeCliente = new Map(clientes.map((c) => [c.id, c.nome]));

  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const hubAdded = new Set<string>();

  function ensureHub(id: string, type: "cliente" | "pessoa", label: string) {
    if (hubAdded.has(id)) return;
    hubAdded.add(id);
    nodes.push({ id, type, label });
  }

  for (const t of tasks) {
    const taskNodeId = `task:${t.id}`;
    nodes.push({
      id: taskNodeId,
      type: "task",
      label: t.titulo,
      taskId: t.id,
      status: t.status,
      prioridade: t.prioridade,
    });

    if (t.client_id) {
      const cid = `cliente:${t.client_id}`;
      ensureHub(cid, "cliente", nomeCliente.get(t.client_id) ?? "Cliente");
      links.push({ source: taskNodeId, target: cid });
    }
    if (t.atribuido_a) {
      const pid = `pessoa:${t.atribuido_a}`;
      ensureHub(pid, "pessoa", nomePessoa.get(t.atribuido_a) ?? "Pessoa");
      links.push({ source: taskNodeId, target: pid });
    }
    for (const partId of t.participantes_ids ?? []) {
      if (partId === t.atribuido_a) continue; // evita link duplicado
      const pid = `pessoa:${partId}`;
      ensureHub(pid, "pessoa", nomePessoa.get(partId) ?? "Pessoa");
      links.push({ source: taskNodeId, target: pid });
    }
  }

  return { nodes, links };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/tarefas-graph.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tarefas/graph.ts tests/unit/tarefas-graph.test.ts
git commit -m "feat(tarefas): buildTaskGraph (montagem do grafo, puro + testes)"
```

---

## Task 2: Instalar lib + componente `TasksGraph`

**Files:**
- Modify: `package.json` (via npm install)
- Create: `src/components/tarefas/TasksGraph.tsx`

- [ ] **Step 1: Instalar a biblioteca**

Run: `npm install react-force-graph-2d@^1.29.1`
Expected: adiciona em `dependencies` do package.json (peer `react: '*'` → ok com React 19).

- [ ] **Step 2: Write the component**

```tsx
// src/components/tarefas/TasksGraph.tsx
"use client";

import { useMemo, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { buildTaskGraph, type GraphNode } from "@/lib/tarefas/graph";
import type { TaskRow } from "@/lib/tarefas/queries";

// Carrega o force-graph só no client (usa canvas/window).
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

const STATUS_CORES: Record<string, string> = {
  aberta: "#94a3b8",
  em_andamento: "#3b82f6",
  concluida: "#22c55e",
  em_aprovacao: "#a855f7",
  aprovada: "#14b8a6",
  postada: "#10b981",
};
const PRIORIDADE_CORES: Record<string, string> = {
  alta: "#ef4444",
  media: "#f59e0b",
  baixa: "#60a5fa",
};
const COR_CLIENTE = "#f97316";
const COR_PESSOA = "#e2e8f0";

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  em_aprovacao: "Em aprovação",
  aprovada: "Aprovada",
  postada: "Postada",
};

interface Props {
  tasks: TaskRow[];
  profiles: Array<{ id: string; nome: string }>;
  clientes: Array<{ id: string; nome: string }>;
}

export function TasksGraph({ tasks, profiles, clientes }: Props) {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const [colorBy, setColorBy] = useState<"status" | "prioridade">("status");
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");

  const fullGraph = useMemo(
    () =>
      buildTaskGraph(
        tasks.map((t) => ({
          id: t.id,
          titulo: t.titulo,
          status: t.status,
          prioridade: t.prioridade,
          client_id: t.client_id,
          atribuido_a: t.atribuido_a,
          participantes_ids: t.participantes_ids,
        })),
        profiles,
        clientes,
      ),
    [tasks, profiles, clientes],
  );

  // Filtro: por status e busca (texto no label da tarefa). Mantém hubs ligados ao que sobrou.
  const graphData = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const taskOk = (n: GraphNode) =>
      n.type === "task" &&
      (statusFiltro === "todos" || n.status === statusFiltro) &&
      (q === "" || n.label.toLowerCase().includes(q));

    const taskNodes = fullGraph.nodes.filter(taskOk);
    const keptTaskIds = new Set(taskNodes.map((n) => n.id));
    const linksKept = fullGraph.links.filter((l) => keptTaskIds.has(l.source));
    const hubIds = new Set(linksKept.map((l) => l.target));
    const hubNodes = fullGraph.nodes.filter((n) => n.type !== "task" && hubIds.has(n.id));

    // Clona (o force-graph muta os objetos com x/y).
    return {
      nodes: [...taskNodes, ...hubNodes].map((n) => ({ ...n })),
      links: linksKept.map((l) => ({ ...l })),
    };
  }, [fullGraph, busca, statusFiltro]);

  const nodeColor = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any) => {
      const n = node as GraphNode;
      if (n.type === "cliente") return COR_CLIENTE;
      if (n.type === "pessoa") return COR_PESSOA;
      if (colorBy === "prioridade") return PRIORIDADE_CORES[n.prioridade ?? ""] ?? "#94a3b8";
      return STATUS_CORES[n.status ?? ""] ?? "#94a3b8";
    },
    [colorBy],
  );

  const nodeVal = useCallback((node: unknown) => {
    const n = node as GraphNode;
    return n.type === "cliente" ? 8 : n.type === "pessoa" ? 5 : 2;
  }, []);

  const onNodeClick = useCallback(
    (node: unknown) => {
      const n = node as GraphNode;
      if (n.type === "task" && n.taskId) router.push(`/tarefas/${n.taskId}`);
    },
    [router],
  );

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">
        Nenhuma tarefa pra desenhar.
      </div>
    );
  }

  return (
    <div className="relative h-[70vh] overflow-hidden rounded-lg border bg-card">
      {/* Controles */}
      <div className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar tarefa..."
          className="h-8 w-44 rounded-md border bg-background px-2 text-xs"
        />
        <select
          value={statusFiltro}
          onChange={(e) => setStatusFiltro(e.target.value)}
          className="h-8 rounded-md border bg-background px-2 text-xs"
        >
          <option value="todos">Todos status</option>
          {Object.keys(STATUS_CORES).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setColorBy((c) => (c === "status" ? "prioridade" : "status"))}
          className="h-8 rounded-md border bg-background px-2 text-xs hover:bg-muted"
        >
          Cor: {colorBy === "status" ? "Status" : "Prioridade"}
        </button>
      </div>

      {/* Legenda */}
      <div className="absolute bottom-3 right-3 z-10 rounded-md border bg-background/90 p-2 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: COR_CLIENTE }} /> Cliente</div>
        <div className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: COR_PESSOA }} /> Pessoa</div>
        <div className="mt-1">Tarefa colorida por {colorBy === "status" ? "status" : "prioridade"}</div>
      </div>

      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodeLabel={(n: any) => (n as GraphNode).label}
        nodeColor={nodeColor}
        nodeVal={nodeVal}
        nodeRelSize={4}
        linkColor={() => "rgba(148,163,184,0.25)"}
        linkWidth={1}
        onNodeClick={onNodeClick}
        cooldownTicks={120}
        backgroundColor="transparent"
      />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "TasksGraph|tarefas/graph" || echo "OK"`
Expected: `OK` (se a tipagem de `react-force-graph-2d` reclamar, os `any` anotados cobrem).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/components/tarefas/TasksGraph.tsx
git commit -m "feat(tarefas): componente TasksGraph (force-graph estilo Obsidian)"
```

---

## Task 3: Wiring (ViewToggle + page)

**Files:**
- Modify: `src/components/tarefas/ViewToggle.tsx`
- Modify: `src/app/(authed)/tarefas/page.tsx`

- [ ] **Step 1: ViewToggle — aceitar "grafico" + botão**

Em `src/components/tarefas/ViewToggle.tsx`:

1. Import: `import { LayoutGrid, List, Share2 } from "lucide-react";`
2. Assinatura: `export function ViewToggle({ current }: { current: "board" | "list" | "grafico" }) {`
3. `setView`: `function setView(v: "board" | "list" | "grafico") {` (resto igual; `board` deleta o param, os outros setam).
4. Antes do `</div>` de fechamento, adicione o botão:

```tsx
      <button
        type="button"
        onClick={() => setView("grafico")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
          current === "grafico" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Share2 className="h-3.5 w-3.5" /> Gráfico
      </button>
```

- [ ] **Step 2: page.tsx — aceitar view=grafico + render**

Em `src/app/(authed)/tarefas/page.tsx`:

1. Import do componente (junto aos outros de tarefas):

```ts
import { TasksGraph } from "@/components/tarefas/TasksGraph";
```

2. Troque o tipo e o parse da view:

```ts
type View = "board" | "list" | "grafico";
```

```ts
  const view: View =
    params.view === "list" ? "list" : params.view === "grafico" ? "grafico" : "board";
```

3. Troque o render condicional final por:

```tsx
      {view === "board" ? (
        <TasksBoard tasks={tasks} userRole={user.role} />
      ) : view === "grafico" ? (
        <TasksGraph
          tasks={tasks}
          profiles={(profiles ?? []) as { id: string; nome: string }[]}
          clientes={(clientes ?? []) as { id: string; nome: string }[]}
        />
      ) : (
        <TasksGroupedList tasks={tasks} groupBy={groupBy} userRole={user.role} />
      )}
```

> `GroupBySelector` só aparece em `view === "list"` (já é o caso) — no gráfico não aparece, ok.

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit 2>&1 | grep -E "ViewToggle|tarefas/page|TasksGraph" || echo "tsc OK"`
Run: `npx eslint src/components/tarefas/ViewToggle.tsx "src/app/(authed)/tarefas/page.tsx" src/components/tarefas/TasksGraph.tsx src/lib/tarefas/graph.ts`
Expected: `tsc OK` e lint sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/components/tarefas/ViewToggle.tsx "src/app/(authed)/tarefas/page.tsx"
git commit -m "feat(tarefas): liga a visão Gráfico no seletor e na página"
```

---

## Task 4: Verificação final + PR

- [ ] **Step 1: Testes + lint + typecheck** (comandos das tasks anteriores). Tudo verde.

- [ ] **Step 2: Build sanity (opcional, se rápido)**: `npx next build` pode ser pesado; pular se demorar — o CI faz o build.

- [ ] **Step 3: Push + PR**

```bash
git push -u origin feat/tarefas-grafico
gh pr create --title "feat(tarefas): visão Gráfico (estilo Obsidian)" --body "..."
```

- [ ] **Step 4: Esperar CI verde. Merge fica com a usuária. Sem migration.**

---

## Self-Review (preenchido)

- **Spec coverage:** hubs cliente+pessoa → buildTaskGraph; cor por status c/ toggle prioridade → nodeColor+colorBy; clique abre tarefa → onNodeClick; filtros embutidos (busca+status) → controles; escopo "tudo" + filtro → graphData filtra; sem migration → confirmado. ✓
- **Placeholders:** corpo do PR "..." preenchido no gh pr create. Resto completo. ✓
- **Type consistency:** `GraphNode`/`GraphTask`/`TaskGraph` definidos na Task 1, usados na Task 2; `TaskRow` mapeado pra `GraphTask` no componente; ids `task:`/`cliente:`/`pessoa:` consistentes entre build e filtros. ✓
- **Risco:** tipos de `react-force-graph-2d` podem ser frouxos → `any` anotados nos callbacks. dynamic import ssr:false evita erro de SSR.
