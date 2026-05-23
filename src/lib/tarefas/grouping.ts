import { localIsoDate } from "@/lib/utils/date";
import type { TaskRow } from "./queries";

export type PrazoUrgency = "overdue" | "today" | "week" | "future" | "none";

export function prazoUrgency(due_date: string | null, today: Date = new Date()): PrazoUrgency {
  if (!due_date) return "none";
  const todayIso = localIsoDate(today);
  const in7Date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
  const in7Iso = localIsoDate(in7Date);
  if (due_date < todayIso) return "overdue";
  if (due_date === todayIso) return "today";
  if (due_date <= in7Iso) return "week";
  return "future";
}

export function formatPrazoLabel(due_date: string | null, today: Date = new Date()): string {
  if (!due_date) return "-";
  const todayIso = localIsoDate(today);
  if (due_date === todayIso) return "Hoje";
  // Calcula diff em dias usando datas locais (sem TZ trickery)
  const [y, m, d] = due_date.split("-").map(Number);
  const dueLocal = new Date(y, m - 1, d);
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round((dueLocal.getTime() - todayLocal.getTime()) / 86400000);
  if (diffDays < 0) return `Venceu há ${-diffDays}d`;
  if (diffDays <= 7) return `Em ${diffDays}d`;
  return dueLocal.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
}

export const PRAZO_GROUPS = ["atrasadas", "hoje", "semana", "sem_prazo", "futuras", "concluidas"] as const;
export type PrazoGroupKey = (typeof PRAZO_GROUPS)[number];

export const PRAZO_GROUP_LABELS: Record<PrazoGroupKey, string> = {
  atrasadas: "Atrasadas",
  hoje: "Hoje",
  semana: "Esta semana",
  sem_prazo: "Sem prazo",
  futuras: "Futuras",
  concluidas: "Concluídas",
};

export function groupTasksByPrazo(
  tasks: TaskRow[],
  today: Date = new Date(),
): Record<PrazoGroupKey, TaskRow[]> {
  const groups: Record<PrazoGroupKey, TaskRow[]> = {
    atrasadas: [], hoje: [], semana: [], sem_prazo: [], futuras: [], concluidas: [],
  };
  for (const t of tasks) {
    if (t.status === "concluida" || t.status === "postada") {
      groups.concluidas.push(t);
      continue;
    }
    const u = prazoUrgency(t.due_date, today);
    if (u === "overdue") groups.atrasadas.push(t);
    else if (u === "today") groups.hoje.push(t);
    else if (u === "week") groups.semana.push(t);
    else if (u === "future") groups.futuras.push(t);
    else groups.sem_prazo.push(t);
  }
  return groups;
}

export function groupTasksByCliente(tasks: TaskRow[]): Map<string, TaskRow[]> {
  const out = new Map<string, TaskRow[]>();
  for (const t of tasks) {
    const key = t.cliente?.nome ?? "(Sem cliente)";
    const arr = out.get(key) ?? [];
    arr.push(t);
    out.set(key, arr);
  }
  return out;
}

export function groupTasksByResponsavel(tasks: TaskRow[]): Map<string, TaskRow[]> {
  const out = new Map<string, TaskRow[]>();
  for (const t of tasks) {
    const key = t.atribuido?.nome ?? "(Sem responsável)";
    const arr = out.get(key) ?? [];
    arr.push(t);
    out.set(key, arr);
  }
  return out;
}

export function groupTasksByPrioridade(tasks: TaskRow[]): Record<"alta" | "media" | "baixa", TaskRow[]> {
  return {
    alta: tasks.filter((t) => t.prioridade === "alta"),
    media: tasks.filter((t) => t.prioridade === "media"),
    baixa: tasks.filter((t) => t.prioridade === "baixa"),
  };
}
