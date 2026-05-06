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

export function TasksGroupedList({ tasks, groupBy, userRole }: { tasks: TaskRow[]; groupBy: GroupBy; userRole: string }) {
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
                {s.tasks.map((t) => <TaskCard key={t.id} task={t} userRole={userRole} />)}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
