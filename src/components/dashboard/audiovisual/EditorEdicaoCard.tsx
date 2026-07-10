import Link from "next/link";
import { ExternalLink } from "lucide-react";
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

// Avatar: iniciais + cor determinística (mesma pessoa = mesma cor sempre).
const AVATAR_COLORS = [
  "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400",
  "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
];

function iniciais(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return nome.trim().slice(0, 2).toUpperCase();
}

function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

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

/** Uma tarefa como linha leve (sem box por tarefa). Atrasada ganha traço lateral. */
function TaskRow({ t, atrasada = false }: { t: TaskItem; atrasada?: boolean }) {
  const dias = atrasada ? diasAtraso(t.due_date) : null;
  return (
    <Link
      href={`/tarefas/${t.id}`}
      className={`group flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60 ${
        atrasada ? "border-l-2 border-l-rose-500 bg-rose-500/[0.03] pl-2.5" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-baseline gap-1.5 text-[13px] font-medium leading-snug">
          <span className="max-w-[42%] shrink-0 truncate rounded bg-muted px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t.cliente_nome ?? "Sem cliente"}
          </span>
          <span className="truncate">{t.titulo}</span>
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
          <span>{STATUS_LABEL[t.status] ?? t.status}</span>
          <span aria-hidden>·</span>
          <span className={atrasada ? "font-medium text-rose-600 dark:text-rose-400" : ""}>
            {formatDueDateBR(t.due_date)}
            {atrasada && dias !== null && ` (${dias === 1 ? "1 dia" : `${dias} dias`})`}
          </span>
          {t.prioridade && (
            <span className={`rounded border px-1 py-px text-[9px] uppercase ${PRIO_BADGE[t.prioridade] ?? ""}`}>
              {t.prioridade}
            </span>
          )}
        </p>
      </div>
      <ExternalLink className="mt-1 h-3 w-3 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

function TaskGroup({
  titulo,
  tom = "muted",
  tasks,
  atrasada = false,
}: {
  titulo: string;
  tom?: "muted" | "danger";
  tasks: TaskItem[];
  atrasada?: boolean;
}) {
  if (tasks.length === 0) return null;
  const headerColor = tom === "danger" ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground/70";
  return (
    <div>
      <h5 className={`mb-0.5 px-2 text-[10px] font-semibold uppercase tracking-wider ${headerColor}`}>
        {titulo} ({tasks.length})
      </h5>
      <div className="space-y-px">
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
    <div className="mb-3 break-inside-avoid overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* Cabeçalho: avatar + nome (identidade clara) + contagens. Separado por linha. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b bg-muted/20 px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor(e.id)}`}
          >
            {iniciais(e.nome)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{e.nome}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{roleLabel(e.role)}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-x-2 text-[11px] text-muted-foreground">
          {e.atrasadas > 0 && (
            <span className="rounded-full bg-rose-500/10 px-1.5 py-0.5 font-semibold text-rose-600 dark:text-rose-400">
              {e.atrasadas} atrasada{e.atrasadas > 1 ? "s" : ""}
            </span>
          )}
          <span>
            <span className="font-semibold tabular-nums text-foreground/80">{e.proximas}</span> próx.
          </span>
          <span>
            <span className="font-semibold tabular-nums text-foreground/80">{e.emAndamento}</span> and.
          </span>
          <span>
            <span className="font-semibold tabular-nums text-foreground/80">{e.concluidas}</span> concl.
          </span>
        </div>
      </div>

      {/* Corpo: tarefas em linhas leves, agrupadas. */}
      <div className="space-y-2.5 p-2.5">
        {semPendentes ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">Sem tarefas pendentes.</p>
        ) : (
          <>
            <TaskGroup titulo="Atrasadas" tom="danger" tasks={e.atrasadasList} atrasada />
            <TaskGroup titulo="Próximas" tasks={e.proximasList} />
            <TaskGroup titulo="Em andamento" tasks={e.emAndamentoList} />
          </>
        )}
      </div>
    </div>
  );
}
