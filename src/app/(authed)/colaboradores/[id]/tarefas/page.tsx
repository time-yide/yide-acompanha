import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  ListTodo,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
} from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { roleLabel } from "@/lib/auth/permissions";
import { getColaboradorById } from "@/lib/colaboradores/queries";
import { listTasks, type TaskRow } from "@/lib/tarefas/queries";
import { localIsoDate } from "@/lib/utils/date";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Gestão que pode ver o histórico de qualquer colaborador (espelha
// canManageAnyTask). Além deles, o próprio colaborador vê o dele.
const MANAGER_ROLES = ["adm", "socio", "coordenador", "assessor", "audiovisual_chefe"];

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  alteracao: "Alteração",
  em_aprovacao: "Em aprovação",
  aprovada: "Aprovada",
  agendado: "Agendado",
  concluida: "Concluída op.",
  postada: "Postada/Entregue",
};

// Estados terminais (tarefa entregue/finalizada).
const DONE = new Set(["concluida", "postada"]);

function isOverdue(t: TaskRow, todayIso: string): boolean {
  return !DONE.has(t.status) && !!t.due_date && t.due_date < todayIso;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = iso.length === 10 ? iso : iso.slice(0, 10);
  const [y, m, dd] = d.split("-").map(Number);
  if (!y || !m || !dd) return String(iso);
  return new Date(y, m - 1, dd).toLocaleDateString("pt-BR");
}

function monthLabel(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  if (!y || !m) return mes;
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

export default async function ColaboradorTarefasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; mes?: string }>;
}) {
  const { id } = await params;
  const { status: statusFilter, mes: mesFilter } = await searchParams;
  const user = await requireAuth();

  const isSelf = user.id === id;
  const isManager = MANAGER_ROLES.includes(user.role);
  if (!isSelf && !isManager) notFound();

  let colab;
  try {
    colab = await getColaboradorById(id);
  } catch {
    notFound();
  }

  const allTasks = await listTasks({ atribuidoA: id });

  // Métricas sobre TODAS as tarefas (não dependem do filtro aplicado).
  const todayIso = localIsoDate();
  const total = allTasks.length;
  const concluidas = allTasks.filter((t) => DONE.has(t.status)).length;
  const emAberto = allTasks.filter((t) => !DONE.has(t.status)).length;
  const atrasadas = allTasks.filter((t) => isOverdue(t, todayIso)).length;

  // Contagem por status (pros chips de filtro só mostrarem o que existe).
  const statusCounts = new Map<string, number>();
  for (const t of allTasks) statusCounts.set(t.status, (statusCounts.get(t.status) ?? 0) + 1);
  const statusesPresentes = [...statusCounts.keys()].sort(
    (a, b) => (statusCounts.get(b) ?? 0) - (statusCounts.get(a) ?? 0),
  );

  // Meses presentes (por created_at), mais recentes primeiro.
  const mesesSet = new Set<string>();
  for (const t of allTasks) if (t.created_at) mesesSet.add(t.created_at.slice(0, 7));
  const meses = [...mesesSet].sort().reverse().slice(0, 12);

  // Aplica filtros pra lista exibida.
  let list = allTasks;
  if (statusFilter && statusFilter !== "todas") list = list.filter((t) => t.status === statusFilter);
  if (mesFilter) list = list.filter((t) => t.created_at?.slice(0, 7) === mesFilter);
  // Histórico: mais recentes primeiro (por criação).
  list = [...list].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

  const hrefWith = (patch: { status?: string; mes?: string }) => {
    const s = patch.status !== undefined ? patch.status : statusFilter;
    const m = patch.mes !== undefined ? patch.mes : mesFilter;
    const sp = new URLSearchParams();
    if (s && s !== "todas") sp.set("status", s);
    if (m) sp.set("mes", m);
    const qs = sp.toString();
    return `/colaboradores/${id}/tarefas${qs ? `?${qs}` : ""}`;
  };

  const statusAtivo = statusFilter && statusFilter !== "todas" ? statusFilter : "todas";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <Link
          href={`/colaboradores/${id}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {colab.nome}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Histórico de tarefas</h1>
        <p className="text-sm text-muted-foreground">
          {colab.nome} · {roleLabel(colab.role)}
        </p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard icon={<ListTodo className="h-3.5 w-3.5" />} label="Total" value={total} />
        <MetricCard
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          label="Concluídas / entregues"
          value={concluidas}
        />
        <MetricCard icon={<FolderOpen className="h-3.5 w-3.5" />} label="Em aberto" value={emAberto} />
        <MetricCard
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          label="Atrasadas"
          value={atrasadas}
          danger={atrasadas > 0}
        />
      </div>

      {/* Filtros de status */}
      {total > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <FilterChip href={hrefWith({ status: "todas" })} active={statusAtivo === "todas"}>
              Todas ({total})
            </FilterChip>
            {statusesPresentes.map((s) => (
              <FilterChip key={s} href={hrefWith({ status: s })} active={statusAtivo === s}>
                {STATUS_LABEL[s] ?? s} ({statusCounts.get(s)})
              </FilterChip>
            ))}
          </div>
          {meses.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Mês:</span>
              <FilterChip href={hrefWith({ mes: undefined })} active={!mesFilter}>
                Todos
              </FilterChip>
              {meses.map((m) => (
                <FilterChip key={m} href={hrefWith({ mes: m })} active={mesFilter === m}>
                  {monthLabel(m)}
                </FilterChip>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lista */}
      {list.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {total === 0 ? "Nenhuma tarefa atribuída ainda." : "Nenhuma tarefa com esses filtros."}
        </Card>
      ) : (
        <div className="space-y-1.5">
          {list.map((t) => {
            const atrasada = isOverdue(t, todayIso);
            return (
              <Link
                key={t.id}
                href={`/tarefas/${t.id}`}
                className={cn(
                  "group flex items-start justify-between gap-2 rounded-lg border px-3 py-2.5 transition-colors",
                  atrasada
                    ? "border-rose-500/40 bg-rose-500/5 hover:bg-rose-500/10"
                    : "border-border bg-card hover:bg-muted/40",
                )}
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="truncate text-sm font-medium">
                    {t.cliente?.nome && (
                      <span className="mr-1.5 rounded bg-muted px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t.cliente.nome}
                      </span>
                    )}
                    {t.titulo}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span className="rounded border px-1.5 py-0 uppercase">
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                    <span className={atrasada ? "font-medium text-rose-600 dark:text-rose-400" : ""}>
                      Prazo {fmtDate(t.due_date)}
                    </span>
                    {DONE.has(t.status) && t.completed_at && (
                      <span>· Finalizada {fmtDate(t.completed_at)}</span>
                    )}
                    {t.drive_link && (
                      <span className="text-primary">· com entrega</span>
                    )}
                  </div>
                </div>
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        danger ? "border-rose-500/40 bg-rose-500/5" : "bg-card",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 text-xs uppercase tracking-wider",
          danger ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground",
        )}
      >
        {icon} {label}
      </div>
      <p
        className={cn(
          "mt-1 text-2xl font-bold tabular-nums",
          danger ? "text-rose-600 dark:text-rose-400" : "",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}
