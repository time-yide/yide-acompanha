"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { TasksColumn } from "./TasksColumn";
import { moveTaskStatusAction } from "@/lib/tarefas/actions";
import type { TaskRow } from "@/lib/tarefas/queries";

type Status = "aberta" | "em_andamento" | "concluida";
const STATUSES: Status[] = ["aberta", "em_andamento", "concluida"];

export function TasksBoard({ tasks, userRole }: { tasks: TaskRow[]; userRole: string }) {
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
              userRole={userRole}
              onDropTask={(taskId, fromStatus) => handleDrop(taskId, fromStatus, s)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
