"use client";

import { useRouter } from "next/navigation";
import { prazoUrgency, formatPrazoLabel } from "@/lib/tarefas/grouping";
import type { TaskRow } from "@/lib/tarefas/queries";
import { cn } from "@/lib/utils";

interface Props {
  task: TaskRow;
  userRole: string;
  /** Quando true, card é arrastável (Quadro). Padrão: false (Lista). */
  draggable?: boolean;
}

// Card minimalista: só título, cliente, quem criou, prazo. Status,
// aprovação, anexos, participantes etc. ficam pra tela de detalhe.
// Sinalização de prioridade via faixa lateral esquerda (border-l):
// vermelho=alta, amarelo=média, cinza=baixa. Único outro acento de
// cor é "atrasada" (destructive no texto do prazo).

const PRIORITY_BORDER: Record<string, string> = {
  alta: "border-l-4 border-l-rose-500",
  media: "border-l-4 border-l-amber-500",
  baixa: "border-l-4 border-l-slate-400",
};

export function TaskCard({ task, draggable = false }: Props) {
  const router = useRouter();

  function onDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("text/task-id", task.id);
    e.dataTransfer.setData("text/from-status", task.status);
    e.dataTransfer.effectAllowed = "move";
  }

  function navigateToTask(e: React.MouseEvent | React.KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (target.closest('a, button, [data-no-card-click="true"]')) return;
    router.push(`/tarefas/${task.id}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      navigateToTask(e);
    }
  }

  const urgency = prazoUrgency(task.due_date);
  const isCompleted = task.status === "concluida" || task.status === "postada";
  const criadorNome = task.criador?.nome ?? null;
  const clienteNome = task.cliente?.nome ?? null;
  const prazoLabel = formatPrazoLabel(task.due_date);

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`Abrir tarefa ${task.titulo}`}
      onClick={navigateToTask}
      onKeyDown={onKeyDown}
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      className={cn(
        "group rounded-lg border bg-card p-3 transition-colors hover:bg-card/80",
        PRIORITY_BORDER[task.prioridade] ?? "",
        "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        draggable && "cursor-grab active:cursor-grabbing [&[draggable=true]:active]:opacity-50",
        isCompleted && "opacity-60",
      )}
    >
      <div className="space-y-2">
        <h3 className={cn("text-sm font-medium leading-snug", isCompleted && "line-through text-muted-foreground")}>
          {task.titulo}
        </h3>

        <div className="space-y-0.5 text-[11px] text-muted-foreground">
          {clienteNome && (
            <p className="truncate">{clienteNome}</p>
          )}
          {prazoLabel && (
            <p className={cn("truncate", urgency === "overdue" && "text-destructive font-medium")}>
              {prazoLabel}
            </p>
          )}
          {criadorNome && (
            <p className="truncate">por {criadorNome}</p>
          )}
        </div>
      </div>
    </div>
  );
}
