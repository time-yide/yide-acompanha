import Link from "next/link";
import { getMinhasTarefasPendentes, type TarefaPendenteRow } from "@/lib/dashboard/personal";
import { cn } from "@/lib/utils";
import { getDatePartsInAppTz } from "@/lib/datetime/timezone";

interface Props {
  userId: string;
}

function formatDueDate(iso: string | null): string {
  if (!iso) return "Sem prazo";
  // `iso` é coluna DATE pura (YYYY-MM-DD). Parse manual evita o bug de
  // `new Date(iso)` interpretar como meia-noite UTC → D-1 em Cuiabá.
  const datePart = iso.length === 10 ? iso : iso.slice(0, 10);
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function urgencyClass(due: string | null): string {
  if (!due) return "text-muted-foreground";
  // Compara via "hoje" no fuso da app (Cuiabá) - não usa Date local.
  const datePart = due.length === 10 ? due : due.slice(0, 10);
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return "text-muted-foreground";
  const todayParts = getDatePartsInAppTz(new Date());
  const todayUtc = Date.UTC(
    parseInt(todayParts.year, 10),
    parseInt(todayParts.month, 10) - 1,
    parseInt(todayParts.day, 10),
  );
  const dueUtc = Date.UTC(y, m - 1, d);
  const diffDays = (dueUtc - todayUtc) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "text-rose-600 dark:text-rose-400 font-semibold";
  if (diffDays < 2) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

function TaskItem({ t }: { t: TarefaPendenteRow }) {
  return (
    <li>
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
  );
}

export async function MinhasTarefasPendentes({ userId }: Props) {
  const tarefas = await getMinhasTarefasPendentes(userId);

  // Separa em dois grupos pra dar visão imediata do estado (antes precisava
  // clicar uma a uma pra ver se estava em alteração ou não).
  const andamento = tarefas.filter(
    (t) => t.status === "aberta" || t.status === "em_andamento",
  );
  const alteracao = tarefas.filter((t) => t.status === "alteracao");

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
        <div className="space-y-4">
          {andamento.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Em andamento
                <span className="font-normal">({andamento.length})</span>
              </div>
              <ul className="space-y-2">
                {andamento.map((t) => (
                  <TaskItem key={t.id} t={t} />
                ))}
              </ul>
            </div>
          )}
          {alteracao.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Em alteração
                <span className="font-normal">({alteracao.length})</span>
              </div>
              <ul className="space-y-2">
                {alteracao.map((t) => (
                  <TaskItem key={t.id} t={t} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
