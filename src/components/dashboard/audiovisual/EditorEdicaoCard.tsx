import Link from "next/link";
import { AlertTriangle, ListTodo, Wrench, ExternalLink } from "lucide-react";
import type { EditorStat, TaskItem } from "@/lib/dashboard/audiovisual";
import { getDatePartsInAppTz } from "@/lib/datetime/timezone";

function roleLabel(role: string): string {
  if (role === "videomaker") return "Videomaker";
  if (role === "fast_midia") return "Fast Mídia";
  if (role === "audiovisual_chefe") return "Coordenador audiovisual";
  if (role === "editor") return "Editor";
  return role;
}

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  alteracao: "Alteração",
  em_aprovacao: "Em aprovação",
  concluida: "Concluída",
  aprovada: "Aprovada",
  agendado: "Agendado",
  postada: "Postada",
};

const PRIO_BADGE: Record<string, string> = {
  alta: "border-rose-500/40 text-rose-600 dark:text-rose-400",
  media: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  baixa: "border-muted-foreground/30 text-muted-foreground",
};

function formatDueDateBR(iso: string | null): string {
  if (!iso) return "Sem prazo";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
}

function diasAtraso(due: string | null): number | null {
  if (!due) return null;
  const [y, m, d] = due.split("-").map(Number);
  if (!y || !m || !d) return null;
  // "Hoje" como UTC midnight do dia no fuso da app (Cuiabá UTC-4) - comparação
  // puramente de calendário.
  const parts = getDatePartsInAppTz(new Date());
  const hojeUTC = Date.UTC(
    parseInt(parts.year, 10),
    parseInt(parts.month, 10) - 1,
    parseInt(parts.day, 10),
  );
  const dueUTC = Date.UTC(y, m - 1, d);
  const diff = Math.round((hojeUTC - dueUTC) / 86400000);
  return diff > 0 ? diff : null;
}

function TaskRow({ t, atrasada = false }: { t: TaskItem; atrasada?: boolean }) {
  const dias = atrasada ? diasAtraso(t.due_date) : null;
  return (
    <Link
      href={`/tarefas/${t.id}`}
      className={`flex items-start justify-between gap-2 rounded-lg border px-3 py-2 transition-colors ${
        atrasada
          ? "border-border border-l-2 border-l-rose-500 bg-rose-500/[0.04] hover:bg-rose-500/[0.08]"
          : "border-border bg-background hover:bg-muted/50"
      }`}
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
          <span className="max-w-[45%] flex-shrink-0 truncate rounded bg-muted px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {t.cliente_nome ?? "Sem cliente"}
          </span>
          <span className="truncate">{t.titulo}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{STATUS_LABEL[t.status] ?? t.status}</span>
          <span className={atrasada ? "text-rose-600 dark:text-rose-400 font-medium" : ""}>
            · Prazo {formatDueDateBR(t.due_date)}
            {atrasada && dias !== null && (
              <span className="ml-1">
                ({dias === 1 ? "1 dia" : `${dias} dias`} de atraso)
              </span>
            )}
          </span>
          {t.prioridade && (
            <span className={`rounded border px-1.5 py-0 text-[10px] uppercase ${PRIO_BADGE[t.prioridade] ?? ""}`}>
              {t.prioridade}
            </span>
          )}
        </div>
      </div>
      <ExternalLink className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
    </Link>
  );
}

function TaskGroup({
  icon,
  titulo,
  tom = "muted",
  tasks,
  atrasada = false,
}: {
  icon: React.ReactNode;
  titulo: string;
  tom?: "muted" | "danger";
  tasks: TaskItem[];
  atrasada?: boolean;
}) {
  if (tasks.length === 0) return null;
  const headerColor = tom === "danger" ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground";
  return (
    <div className="space-y-1.5">
      <h5 className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${headerColor}`}>
        {icon} {titulo} ({tasks.length})
      </h5>
      <div className="space-y-1.5">
        {tasks.map((t) => (
          <TaskRow key={t.id} t={t} atrasada={atrasada} />
        ))}
      </div>
    </div>
  );
}

export function EditorEdicaoCard({ editor: e }: { editor: EditorStat }) {
  const semPendentes =
    e.atrasadasList.length === 0 && e.proximasList.length === 0 && e.emAndamentoList.length === 0;

  return (
    <div className="mb-3 break-inside-avoid rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{e.nome}</p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{roleLabel(e.role)}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
          {e.atrasadas > 0 && (
            <span className="rounded-full bg-rose-500/10 px-2 py-0.5 font-semibold text-rose-600 dark:text-rose-400">
              {e.atrasadas} atrasada{e.atrasadas > 1 ? "s" : ""}
            </span>
          )}
          <span>
            <span className="font-semibold tabular-nums text-foreground/80">{e.proximas}</span> próx.
          </span>
          <span>
            <span className="font-semibold tabular-nums text-foreground/80">{e.emAndamento}</span> em and.
          </span>
          <span>
            <span className="font-semibold tabular-nums text-foreground/80">{e.concluidas}</span> concl.
          </span>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {semPendentes ? (
          <p className="text-xs text-muted-foreground">Sem tarefas pendentes.</p>
        ) : (
          <>
            <TaskGroup
              icon={<AlertTriangle className="h-3 w-3" />}
              titulo="Atrasadas"
              tom="danger"
              tasks={e.atrasadasList}
              atrasada
            />
            <TaskGroup
              icon={<ListTodo className="h-3 w-3" />}
              titulo="Próximas"
              tasks={e.proximasList}
            />
            <TaskGroup
              icon={<Wrench className="h-3 w-3" />}
              titulo="Em andamento"
              tasks={e.emAndamentoList}
            />
          </>
        )}
      </div>
    </div>
  );
}
