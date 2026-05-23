"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { TasksColumn } from "./TasksColumn";
import { ConcludeOperationalModal } from "./ConcludeOperationalModal";
import { moveTaskStatusAction } from "@/lib/tarefas/actions";
import type { TaskRow } from "@/lib/tarefas/queries";

type Status =
  | "aberta"
  | "em_andamento"
  | "concluida"
  | "em_aprovacao"
  | "alteracao"
  | "aprovada"
  | "agendado"
  | "postada";

const STATUSES: Status[] = [
  "aberta",
  "em_andamento",
  "concluida",
  "em_aprovacao",
  "alteracao",
  "aprovada",
  "agendado",
  "postada",
];

export function TasksBoard({ tasks, userRole }: { tasks: TaskRow[]; userRole: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [conclModalOpen, setConclModalOpen] = useState(false);
  const [conclModalTask, setConclModalTask] = useState<{
    id: string;
    tipo: "geral" | "video" | "arte";
    atribuidoRole: string | null;
    toStatus: "concluida" | "em_aprovacao";
  } | null>(null);

  const groups: Record<Status, TaskRow[]> = {
    aberta: [],
    em_andamento: [],
    concluida: [],
    em_aprovacao: [],
    alteracao: [],
    aprovada: [],
    agendado: [],
    postada: [],
  };
  for (const t of tasks) {
    const s = (t.status as Status) ?? "aberta";
    if (groups[s]) groups[s].push(t);
  }

  function handleDrop(taskId: string, _fromStatus: Status, toStatus: Status) {
    setError(null);

    // Mover pra "concluida" ou "em_aprovacao": responsáveis de execução
    // (editor/videomaker/designer/audiovisual_chefe/coordenador/assessor)
    // precisam preencher modal com link de entrega antes da movimentação.
    // Exceção: se a tarefa já tem drive_link salvo (re-conclusão depois de
    // "alteração"), pula o modal - link só é pedido uma vez por tarefa.
    if (toStatus === "concluida" || toStatus === "em_aprovacao") {
      const task = tasks.find((t) => t.id === taskId);
      if (task && !task.drive_link) {
        const role = task.atribuido_a_role;
        const requiresModal =
          role === "editor" ||
          role === "videomaker" ||
          role === "designer" ||
          role === "audiovisual_chefe" ||
          role === "coordenador" ||
          role === "assessor";
        if (requiresModal) {
          setConclModalTask({
            id: taskId,
            tipo: (task.tipo as "geral" | "video" | "arte") ?? "geral",
            atribuidoRole: role ?? null,
            toStatus,
          });
          setConclModalOpen(true);
          return;
        }
      }
    }

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
      {conclModalTask && (
        <ConcludeOperationalModal
          open={conclModalOpen}
          onOpenChange={setConclModalOpen}
          taskId={conclModalTask.id}
          taskTipo={conclModalTask.tipo}
          atribuidoRole={conclModalTask.atribuidoRole}
          toStatus={conclModalTask.toStatus}
          onSuccess={() => router.refresh()}
        />
      )}
    </div>
  );
}
