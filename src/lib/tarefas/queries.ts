import { createClient } from "@/lib/supabase/server";
import { localIsoDate } from "@/lib/utils/date";

const PRIORITY_RANK: Record<string, number> = { alta: 0, media: 1, baixa: 2 };

export interface TaskRow {
  id: string;
  titulo: string;
  descricao?: string | null;
  prioridade: "alta" | "media" | "baixa";
  status: "aberta" | "em_andamento" | "concluida";
  due_date: string | null;
  created_at?: string;
  completed_at?: string | null;
  client_id: string | null;
  atribuido?: { id?: string; nome: string } | null;
  criador?: { id?: string; nome: string } | null;
  cliente?: { id: string; nome: string } | null;
  criado_por?: string;
  atribuido_a?: string;
}

export function sortTasks<T extends Pick<TaskRow, "due_date" | "prioridade">>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    if (a.due_date && b.due_date) {
      if (a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
    } else if (a.due_date && !b.due_date) {
      return -1;
    } else if (!a.due_date && b.due_date) {
      return 1;
    }
    return (PRIORITY_RANK[a.prioridade] ?? 99) - (PRIORITY_RANK[b.prioridade] ?? 99);
  });
}

export type PrazoFilter = "hoje" | "semana" | "vencidas" | "sem_prazo" | "qualquer";

export function filterTasksByPrazo<T extends { due_date: string | null }>(
  tasks: T[],
  prazo: PrazoFilter,
  today: Date = new Date(),
): T[] {
  const todayIso = localIsoDate(today);
  const in7 = new Date(today);
  in7.setDate(in7.getDate() + 7);
  const in7Iso = localIsoDate(in7);

  return tasks.filter((t) => {
    switch (prazo) {
      case "hoje":
        return t.due_date === todayIso;
      case "semana":
        return t.due_date !== null && t.due_date >= todayIso && t.due_date <= in7Iso;
      case "vencidas":
        return t.due_date !== null && t.due_date < todayIso;
      case "sem_prazo":
        return t.due_date === null;
      case "qualquer":
      default:
        return true;
    }
  });
}

export interface TaskFilters {
  status?: ("aberta" | "em_andamento" | "concluida")[];
  atribuidoA?: string;
  criadoPor?: string;
  clientId?: string;
  prioridade?: ("alta" | "media" | "baixa")[];
}

export async function listTasks(filters?: TaskFilters): Promise<TaskRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("tasks")
    .select(`
      id, titulo, descricao, prioridade, status, due_date, created_at, completed_at, client_id, criado_por, atribuido_a,
      atribuido:profiles!tasks_atribuido_a_fkey(id, nome),
      criador:profiles!tasks_criado_por_fkey(id, nome),
      cliente:clients(id, nome)
    `);

  if (filters?.status && filters.status.length > 0) query = query.in("status", filters.status);
  if (filters?.prioridade && filters.prioridade.length > 0) query = query.in("prioridade", filters.prioridade);
  if (filters?.atribuidoA) query = query.eq("atribuido_a", filters.atribuidoA);
  if (filters?.criadoPor) query = query.eq("criado_por", filters.criadoPor);
  if (filters?.clientId) query = query.eq("client_id", filters.clientId);

  const { data, error } = await query;
  if (error) throw error;
  return sortTasks((data ?? []) as TaskRow[]);
}

export async function listTasksForClient(clientId: string): Promise<TaskRow[]> {
  return listTasks({ clientId });
}

export async function getTaskById(id: string): Promise<TaskRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      *,
      atribuido:profiles!tasks_atribuido_a_fkey(id, nome),
      criador:profiles!tasks_criado_por_fkey(id, nome),
      cliente:clients(id, nome)
    `)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as TaskRow;
}

export async function countOpenTasksForUser(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("atribuido_a", userId)
    .neq("status", "concluida");
  return count ?? 0;
}

export async function countOverdueTasksForUser(userId: string): Promise<number> {
  const today = localIsoDate();
  const supabase = await createClient();
  const { count } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("atribuido_a", userId)
    .neq("status", "concluida")
    .lt("due_date", today);
  return count ?? 0;
}
