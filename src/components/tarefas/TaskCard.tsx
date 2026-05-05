"use client";

import Link from "next/link";
import { Paperclip, Link as LinkIcon, ArrowRight } from "lucide-react";
import { prazoUrgency, formatPrazoLabel, type PrazoUrgency } from "@/lib/tarefas/grouping";
import type { TaskRow } from "@/lib/tarefas/queries";
import { cn } from "@/lib/utils";
import { CompleteTaskButton } from "./CompleteTaskButton";

interface Props {
  task: TaskRow;
  userRole: string;
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

/** Primeiro nome — pra mostrar inline no card sem ocupar muita largura. */
function firstName(nome: string | undefined | null): string {
  if (!nome) return "—";
  return nome.trim().split(/\s+/)[0];
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

export function TaskCard({ task, userRole, draggable = false }: Props) {
  function onDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("text/task-id", task.id);
    e.dataTransfer.setData("text/from-status", task.status);
    e.dataTransfer.effectAllowed = "move";
  }

  const urgency = prazoUrgency(task.due_date);
  const isCompleted = task.status === "concluida";
  const responsavelNome = task.atribuido?.nome ?? null;
  const responsavelId = task.atribuido?.id ?? null;
  const criadorNome = task.criador?.nome ?? null;
  const criadorId = task.criador?.id ?? null;
  const clienteNome = task.cliente?.nome ?? null;
  // Quando criador e responsável são a mesma pessoa, mostra só um avatar.
  const sameAuthor = !!criadorId && !!responsavelId && criadorId === responsavelId;

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
          {(criadorNome || responsavelNome) && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              {criadorNome && (
                <span
                  className="flex items-center gap-1"
                  title={sameAuthor ? `Criada por e atribuída a ${criadorNome}` : `Criada por ${criadorNome}`}
                >
                  <span
                    className={cn(
                      "inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold",
                      avatarBg(criadorId),
                    )}
                  >
                    {initials(criadorNome)}
                  </span>
                  <span className="text-foreground/80">{firstName(criadorNome)}</span>
                </span>
              )}
              {!sameAuthor && responsavelNome && (
                <>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span
                    className="flex items-center gap-1"
                    title={`Atribuída a ${responsavelNome}`}
                  >
                    <span
                      className={cn(
                        "inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold",
                        avatarBg(responsavelId),
                      )}
                    >
                      {initials(responsavelNome)}
                    </span>
                    <span className="text-foreground/80">{firstName(responsavelNome)}</span>
                  </span>
                </>
              )}
              {!criadorNome && responsavelNome && (
                <span
                  className="flex items-center gap-1"
                  title={`Atribuída a ${responsavelNome}`}
                >
                  <span
                    className={cn(
                      "inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold",
                      avatarBg(responsavelId),
                    )}
                  >
                    {initials(responsavelNome)}
                  </span>
                  <span className="text-foreground/80">{firstName(responsavelNome)}</span>
                </span>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {clienteNome && (
              <span className="truncate rounded-md border bg-muted/40 px-1.5 py-0.5 text-[10px] max-w-[140px]">
                {clienteNome}
              </span>
            )}
            <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px]", PRAZO_PILL[urgency])}>
              {formatPrazoLabel(task.due_date)}
            </span>
            {(task.attachment_urls?.length ?? 0) > 0 && (
              <span title={`${task.attachment_urls?.length} anexo(s)`} className="inline-flex items-center gap-0.5 text-muted-foreground">
                <Paperclip className="h-3 w-3" />
                <span className="text-[10px]">{task.attachment_urls?.length}</span>
              </span>
            )}
            {(task.links?.length ?? 0) > 0 && (
              <span title={`${task.links?.length} link(s)`} className="inline-flex items-center gap-0.5 text-muted-foreground">
                <LinkIcon className="h-3 w-3" />
                <span className="text-[10px]">{task.links?.length}</span>
              </span>
            )}
            {(task.participantes_ids?.length ?? 0) > 0 && (
              <span title={`+${task.participantes_ids?.length} atribuído(s)`} className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                +{task.participantes_ids?.length}
              </span>
            )}
          </div>
        </div>
        <CompleteTaskButton
          taskId={task.id}
          isCompleted={task.status === "concluida"}
          userRole={userRole}
          size="sm"
          variant="ghost"
          label={task.status === "concluida" ? "↩" : "✓"}
          className="absolute right-2 top-2 hidden h-6 w-6 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 group-hover:inline-flex dark:text-emerald-400 disabled:opacity-50"
        />
      </div>
    </Link>
  );
}
