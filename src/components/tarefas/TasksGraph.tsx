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
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: COR_CLIENTE }} /> Cliente
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: COR_PESSOA }} /> Pessoa
        </div>
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
