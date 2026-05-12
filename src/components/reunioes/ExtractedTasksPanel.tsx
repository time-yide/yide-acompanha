import { ListChecks, Check, ExternalLink, User, Calendar } from "lucide-react";
import Link from "next/link";
import { formatTimestamp, type MeetingExtractedTask } from "@/lib/reunioes/tipos";
import { ExtractedTaskActions } from "./ExtractedTaskActions";

interface Props {
  tasks: MeetingExtractedTask[];
}

const ESTADO_CONFIG: Record<MeetingExtractedTask["estado"], { label: string; cor: string }> = {
  sugerida: { label: "Sugerida", cor: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  aceita: { label: "Aceita", cor: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  descartada: { label: "Descartada", cor: "border-muted-foreground/30 text-muted-foreground" },
};

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
}

export function ExtractedTasksPanel({ tasks }: Props) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        Nenhuma tarefa foi extraída automaticamente desta reunião.
      </div>
    );
  }

  const aceitas = tasks.filter((t) => t.estado === "aceita");
  const sugeridas = tasks.filter((t) => t.estado === "sugerida");
  const descartadas = tasks.filter((t) => t.estado === "descartada");

  return (
    <div className="space-y-5">
      {/* Sugeridas (precisam ação) */}
      {sugeridas.length > 0 && (
        <section className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            <ListChecks className="h-3.5 w-3.5" />
            Sugestões da IA — revisar
          </h4>
          {sugeridas.map((t) => <TaskRow key={t.id} task={t} />)}
        </section>
      )}

      {/* Aceitas (já viraram tasks) */}
      {aceitas.length > 0 && (
        <section className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" />
            Tarefas criadas
          </h4>
          {aceitas.map((t) => <TaskRow key={t.id} task={t} />)}
        </section>
      )}

      {/* Descartadas (collapsed) */}
      {descartadas.length > 0 && (
        <details className="rounded-lg border bg-card/50 px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Descartadas ({descartadas.length})
          </summary>
          <div className="mt-2 space-y-2">
            {descartadas.map((t) => <TaskRow key={t.id} task={t} compact />)}
          </div>
        </details>
      )}
    </div>
  );
}

function TaskRow({ task, compact }: { task: MeetingExtractedTask; compact?: boolean }) {
  const estadoConfig = ESTADO_CONFIG[task.estado];

  return (
    <article
      className={`rounded-lg border bg-card p-3 ${compact ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${estadoConfig.cor}`}>
              {estadoConfig.label}
            </span>
            {task.timestamp_origem_segundos !== null && (
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                @{formatTimestamp(task.timestamp_origem_segundos)}
              </span>
            )}
          </div>
          <p className="text-sm font-medium">{task.titulo_sugerido}</p>
          {task.descricao_sugerida && (
            <p className="text-xs text-muted-foreground">{task.descricao_sugerida}</p>
          )}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {task.atribuido_a_nome && (
              <span className="inline-flex items-center gap-1">
                <User className="h-3 w-3" />
                {task.atribuido_a_nome}
              </span>
            )}
            {task.due_date_sugestao && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDateBR(task.due_date_sugestao)}
              </span>
            )}
            {task.task_id && (
              <Link
                href={`/tarefas/${task.task_id}`}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Ver tarefa <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
          {task.citacao_origem && !compact && (
            <blockquote className="border-l-2 border-muted-foreground/30 pl-3 text-[11px] italic text-muted-foreground">
              &ldquo;{task.citacao_origem}&rdquo;
            </blockquote>
          )}
        </div>
        {task.estado === "sugerida" && !compact && (
          <ExtractedTaskActions extractedTaskId={task.id} />
        )}
      </div>
    </article>
  );
}
