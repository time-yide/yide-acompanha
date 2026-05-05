import Link from "next/link";
import { getMinhasTarefasPendentes } from "@/lib/dashboard/personal";
import { cn } from "@/lib/utils";

interface Props {
  userId: string;
}

function formatDueDate(iso: string | null): string {
  if (!iso) return "Sem prazo";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function urgencyClass(due: string | null): string {
  if (!due) return "text-muted-foreground";
  const dueDate = new Date(due);
  const now = new Date();
  const diffDays = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "text-rose-600 dark:text-rose-400 font-semibold";
  if (diffDays < 2) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

export async function MinhasTarefasPendentes({ userId }: Props) {
  const tarefas = await getMinhasTarefasPendentes(userId);

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground/80">
        Tarefas pendentes
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          ({tarefas.length})
        </span>
      </h2>
      {tarefas.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhuma tarefa pendente. ✨
        </p>
      ) : (
        <ul className="space-y-2">
          {tarefas.map((t) => (
            <li key={t.id}>
              <Link
                href={`/tarefas/${t.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{t.titulo}</p>
                  {t.cliente_nome && (
                    <p className="truncate text-xs text-muted-foreground">{t.cliente_nome}</p>
                  )}
                </div>
                <span className={cn("text-xs tabular-nums", urgencyClass(t.due_date))}>
                  {formatDueDate(t.due_date)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
