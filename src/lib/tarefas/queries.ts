import { createClient } from "@/lib/supabase/server";

export async function listTasks(filters?: {
  status?: "aberta" | "em_andamento" | "concluida";
  atribuidoA?: string;
  criadoPor?: string;
  clientId?: string;
  prioridade?: "alta" | "media" | "baixa";
}) {
  const supabase = await createClient();
  let query = supabase
    .from("tasks")
    .select(`
      id, titulo, descricao, prioridade, status, due_date, created_at, completed_at, client_id,
      atribuido:profiles!tasks_atribuido_a_fkey(id, nome),
      criador:profiles!tasks_criado_por_fkey(id, nome),
      cliente:clients(id, nome)
    `)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.atribuidoA) query = query.eq("atribuido_a", filters.atribuidoA);
  if (filters?.criadoPor) query = query.eq("criado_por", filters.criadoPor);
  if (filters?.clientId) query = query.eq("client_id", filters.clientId);
  if (filters?.prioridade) query = query.eq("prioridade", filters.prioridade);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getTaskById(id: string) {
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
  return data;
}
