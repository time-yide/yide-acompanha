import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { localIsoDate } from "@/lib/utils/date";

const PRIORITY_RANK: Record<string, number> = { alta: 0, media: 1, baixa: 2 };

export interface TaskLink { label?: string; url: string; }

export type TaskTipo = "geral" | "video" | "arte";
export type TaskFormato = "feed" | "story";
export type TaskAprovacao = "pendente_envio" | "em_analise" | "aprovado" | "ajustes_solicitados";
export type TaskRevisaoTipo = "envio" | "aprovacao" | "ajustes";

export type TaskStatus =
  | "aberta"
  | "em_andamento"
  | "concluida"
  | "em_aprovacao"
  | "aprovada"
  | "postada";

export interface TaskRow {
  id: string;
  titulo: string;
  descricao?: string | null;
  prioridade: "alta" | "media" | "baixa";
  status: TaskStatus;
  due_date: string | null;
  created_at?: string;
  completed_at?: string | null;
  aprovada_em?: string | null;
  client_id: string | null;
  atribuido?: { id?: string; nome: string } | null;
  criador?: { id?: string; nome: string } | null;
  cliente?: { id: string; nome: string } | null;
  criado_por?: string;
  atribuido_a?: string;
  participantes_ids?: string[];
  links?: TaskLink[];
  attachment_urls?: string[];
  tipo?: TaskTipo;
  formatos?: TaskFormato[];
  status_aprovacao?: TaskAprovacao | null;
}

export interface TaskRevisao {
  id: string;
  task_id: string;
  autor_id: string;
  tipo: TaskRevisaoTipo;
  observacoes: string | null;
  criado_em: string;
  autor?: { id?: string; nome: string } | null;
}

export interface TaskComment {
  id: string;
  task_id: string;
  autor_id: string;
  conteudo: string;
  criado_em: string;
  autor?: { id?: string; nome: string } | null;
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
  status?: TaskStatus[];
  atribuidoA?: string;
  criadoPor?: string;
  clientId?: string;
  prioridade?: ("alta" | "media" | "baixa")[];
}

async function _listTasksImpl(filters?: TaskFilters): Promise<TaskRow[]> {
  // Service-role pra funcionar dentro de unstable_cache. RLS de SELECT em
  // `tasks` é permissiva (`using (true)`) — resultado idêntico ao cookie-based.
  const supabase = createServiceRoleClient();
  let query = supabase
    .from("tasks")
    .select(`
      id, titulo, descricao, prioridade, status, due_date, created_at, completed_at, aprovada_em, client_id, criado_por, atribuido_a,
      participantes_ids, links, attachment_urls, tipo, formatos, status_aprovacao,
      atribuido:profiles!tasks_atribuido_a_fkey(id, nome),
      criador:profiles!tasks_criado_por_fkey(id, nome),
      cliente:clients(id, nome)
    `)
    .is("deleted_at", null);

  if (filters?.status && filters.status.length > 0) {
    // Cast: types do Supabase não conhecem os novos status enum (em_aprovacao/aprovada/postada).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = query.in("status", filters.status as any);
  }
  if (filters?.prioridade && filters.prioridade.length > 0) query = query.in("prioridade", filters.prioridade);
  // "Atribuídas a mim" agora inclui tarefas onde sou principal OU adicional
  if (filters?.atribuidoA) {
    query = query.or(
      `atribuido_a.eq.${filters.atribuidoA},participantes_ids.cs.{${filters.atribuidoA}}`,
    );
  }
  if (filters?.criadoPor) query = query.eq("criado_por", filters.criadoPor);
  if (filters?.clientId) query = query.eq("client_id", filters.clientId);

  const { data, error } = await query;
  if (error) throw error;
  // Cast via unknown — types ainda não regenerados c/ os campos novos.
  return sortTasks((data ?? []) as unknown as TaskRow[]);
}

export async function listTasks(filters?: TaskFilters): Promise<TaskRow[]> {
  const cached = unstable_cache(
    async (filtersJson: string) => {
      const f = filtersJson !== "null" ? (JSON.parse(filtersJson) as TaskFilters) : undefined;
      return _listTasksImpl(f);
    },
    ["tarefas-list-v3"],
    { revalidate: 60, tags: ["tasks"] },
  );
  return cached(JSON.stringify(filters ?? null));
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
    .is("deleted_at", null)
    .single();
  if (error) throw error;
  return data as TaskRow;
}

export async function listTaskComments(taskId: string): Promise<TaskComment[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb
    .from("task_comments")
    .select(`
      id, task_id, autor_id, conteudo, criado_em,
      autor:profiles!task_comments_autor_id_fkey(id, nome)
    `)
    .eq("task_id", taskId)
    .order("criado_em", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as TaskComment[];
}

export async function listTaskRevisoes(taskId: string): Promise<TaskRevisao[]> {
  const supabase = await createClient();
  // task_revisoes ainda não está nos types gerados — cast via any.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb
    .from("task_revisoes")
    .select(`
      id, task_id, autor_id, tipo, observacoes, criado_em,
      autor:profiles!task_revisoes_autor_id_fkey(id, nome)
    `)
    .eq("task_id", taskId)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as TaskRevisao[];
}

export async function countOpenTasksForUser(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("atribuido_a", userId)
    .is("deleted_at", null)
    .not("status", "in", "(concluida,postada)");
  return count ?? 0;
}

export async function countOverdueTasksForUser(userId: string): Promise<number> {
  const today = localIsoDate();
  const supabase = await createClient();
  const { count } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("atribuido_a", userId)
    .is("deleted_at", null)
    .not("status", "in", "(concluida,postada)")
    .lt("due_date", today);
  return count ?? 0;
}
