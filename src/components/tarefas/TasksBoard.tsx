"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { TasksColumn } from "./TasksColumn";
import { ConcludeOperationalModal } from "./ConcludeOperationalModal";
import { moveTaskStatusAction } from "@/lib/tarefas/actions";
import { precisaModalDeEntrega } from "@/lib/tarefas/delivery-roles";
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

// "Aprovado" não tem coluna própria: tarefas aprovadas (aguardando postagem)
// vivem na coluna "Aprovação" (ver grouping abaixo) até serem marcadas como
// postadas. Por isso "aprovada" fica fora da lista de colunas renderizadas.
const STATUSES: Status[] = [
  "aberta",
  "em_andamento",
  "concluida",
  "em_aprovacao",
  "alteracao",
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
    let s = (t.status as Status) ?? "aberta";
    // Sem coluna "Aprovado": tarefa aprovada aguardando postagem aparece na
    // coluna "Aprovação" até alguém marcar como postada.
    if (s === "aprovada") s = "em_aprovacao";
    if (groups[s]) groups[s].push(t);
  }

  function handleDrop(taskId: string, _fromStatus: Status, toStatus: Status) {
    setError(null);

    // Mover pra "concluida" ou "em_aprovacao": responsáveis de execução
    // precisam preencher o modal de entrega antes da movimentação.
    // Regra única em delivery-roles (espelha o server moveTaskStatusAction):
    // - VÍDEO: sempre abre o modal (sobe pro Frame; ignora drive_link).
    // - Arte/geral com material: abre se ainda não tem drive_link (pedido 1x).
    if (toStatus === "concluida" || toStatus === "em_aprovacao") {
      const task = tasks.find((t) => t.id === taskId);
      const role = task?.atribuido_a_role;
      if (task && precisaModalDeEntrega(task.tipo, role, task.drive_link)) {
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
