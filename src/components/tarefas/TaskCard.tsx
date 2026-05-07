"use client";

import { useRouter } from "next/navigation";
import { Paperclip, Link as LinkIcon, ExternalLink } from "lucide-react";
import { prazoUrgency, formatPrazoLabel, type PrazoUrgency } from "@/lib/tarefas/grouping";
import type { TaskRow, TaskAprovacao } from "@/lib/tarefas/queries";
import { cn } from "@/lib/utils";
import { CompleteTaskButton } from "./CompleteTaskButton";

const APROVACAO_PILL: Record<TaskAprovacao, { label: string; cls: string }> = {
  pendente_envio: { label: "Pendente envio", cls: "border-slate-400/40 text-slate-700 bg-slate-500/10 dark:text-slate-300" },
  em_analise: { label: "Em análise", cls: "border-sky-500/40 text-sky-700 bg-sky-500/10 dark:text-sky-400" },
  aprovado: { label: "Aprovado", cls: "border-emerald-500/40 text-emerald-700 bg-emerald-500/10 dark:text-emerald-400" },
  ajustes_solicitados: { label: "Ajustes", cls: "border-amber-500/40 text-amber-700 bg-amber-500/10 dark:text-amber-400" },
};

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

const MAX_VISIBLE_LINKS = 2;

function initials(nome: string | undefined | null): string {
  if (!nome) return "—";
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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

function shortHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function TaskCard({ task, userRole, draggable = false }: Props) {
  const router = useRouter();

  function onDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("text/task-id", task.id);
    e.dataTransfer.setData("text/from-status", task.status);
    e.dataTransfer.effectAllowed = "move";
  }

  function navigateToTask(e: React.MouseEvent | React.KeyboardEvent) {
    // Não navega se o clique foi em algo interativo (link externo, botão, etc.)
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
  const isCompleted = task.status === "concluida";
  const responsavelNome = task.atribuido?.nome ?? null;
  const responsavelId = task.atribuido?.id ?? null;
  const criadorNome = task.criador?.nome ?? null;
  const clienteNome = task.cliente?.nome ?? null;
  const visibleLinks = (task.links ?? []).slice(0, MAX_VISIBLE_LINKS);
  const extraLinksCount = Math.max(0, (task.links?.length ?? 0) - visibleLinks.length);

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
        "group relative rounded-lg border bg-card p-3 transition-all hover:bg-card/80 hover:shadow-sm",
        "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {responsavelNome && (
              <span
                title={responsavelNome}
                className={cn(
                  "inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold",
                  avatarBg(responsavelId),
                )}
              >
                {initials(responsavelNome)}
              </span>
            )}
            {clienteNome && (
              <span className="truncate rounded-md border bg-muted/40 px-1.5 py-0.5 text-[10px] max-w-[140px]">
                {clienteNome}
              </span>
            )}
            <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px]", PRAZO_PILL[urgency])}>
              {formatPrazoLabel(task.due_date)}
            </span>
            {(task.tipo === "video" || task.tipo === "arte") && task.status_aprovacao && (
              <span
                className={cn(
                  "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px]",
                  APROVACAO_PILL[task.status_aprovacao].cls,
                )}
                title={`${task.tipo === "video" ? "Vídeo" : "Arte"} · ${APROVACAO_PILL[task.status_aprovacao].label}`}
              >
                {task.tipo === "video" ? "🎬" : "🎨"} {APROVACAO_PILL[task.status_aprovacao].label}
              </span>
            )}
            {(task.attachment_urls?.length ?? 0) > 0 && (
              <span title={`${task.attachment_urls?.length} anexo(s)`} className="inline-flex items-center gap-0.5 text-muted-foreground">
                <Paperclip className="h-3 w-3" />
                <span className="text-[10px]">{task.attachment_urls?.length}</span>
              </span>
            )}
            {(task.participantes_ids?.length ?? 0) > 0 && (
              <span title={`+${task.participantes_ids?.length} atribuído(s)`} className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                +{task.participantes_ids?.length}
              </span>
            )}
          </div>
          {criadorNome && (
            <div className="text-[10px] text-muted-foreground">
              Criada por <span className="font-medium">{criadorNome}</span>
            </div>
          )}
          {visibleLinks.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {visibleLinks.map((l, i) => (
                <a
                  key={i}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  draggable={false}
                  onDragStart={(e) => e.stopPropagation()}
                  title={l.url}
                  className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[10px] text-primary hover:bg-primary/10 hover:underline max-w-[180px]"
                >
                  <LinkIcon className="h-2.5 w-2.5 flex-shrink-0" />
                  <span className="truncate">{l.label || shortHostname(l.url)}</span>
                  <ExternalLink className="h-2.5 w-2.5 flex-shrink-0 opacity-60" />
                </a>
              ))}
              {extraLinksCount > 0 && (
                <span className="inline-flex items-center rounded-md border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  +{extraLinksCount}
                </span>
              )}
            </div>
          )}
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
    </div>
  );
}
