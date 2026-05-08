"use client";

import { useState } from "react";
import { TaskCard } from "./TaskCard";
import type { TaskRow } from "@/lib/tarefas/queries";
import { cn } from "@/lib/utils";

type Status =
  | "aberta"
  | "em_andamento"
  | "concluida"
  | "em_aprovacao"
  | "alteracao"
  | "aprovada"
  | "agendado"
  | "postada";

const COLUMN_LABEL: Record<Status, string> = {
  aberta: "A fazer",
  em_andamento: "Em andamento",
  concluida: "Concluído Operacional",
  em_aprovacao: "Aprovação",
  alteracao: "Alteração",
  aprovada: "Aprovado",
  agendado: "Agendado",
  postada: "Postado",
};

interface Props {
  status: Status;
  tasks: TaskRow[];
  userRole: string;
  onDropTask: (taskId: string, fromStatus: Status) => void;
}

export function TasksColumn({ status, tasks, userRole, onDropTask }: Props) {
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
        "flex w-[260px] flex-shrink-0 flex-col rounded-xl border bg-muted/20 transition-colors",
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
          tasks.map((t) => <TaskCard key={t.id} task={t} userRole={userRole} draggable />)
        )}
      </div>
    </div>
  );
}
