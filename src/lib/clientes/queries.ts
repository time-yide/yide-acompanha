import { createClient } from "@/lib/supabase/server";

export interface ClienteRow {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  valor_mensal: number;
  servico_contratado: string | null;
  status: "ativo" | "churn" | "em_onboarding";
  data_entrada: string;
  assessor_id: string | null;
  coordenador_id: string | null;
  assessor_nome?: string | null;
  coordenador_nome?: string | null;
}

export async function listClientes(filters?: {
  status?: "ativo" | "churn" | "em_onboarding";
  assessorId?: string;
  search?: string;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("clients")
    .select(`
      id, nome, email, telefone, valor_mensal, servico_contratado, status, data_entrada,
      assessor_id, coordenador_id,
      assessor:profiles!clients_assessor_id_fkey(nome),
      coordenador:profiles!clients_coordenador_id_fkey(nome)
    `)
    .order("nome");

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.assessorId) query = query.eq("assessor_id", filters.assessorId);
  if (filters?.search) query = query.ilike("nome", `%${filters.search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    ...r,
    valor_mensal: Number(r.valor_mensal),
    assessor_nome: r.assessor?.nome ?? null,
    coordenador_nome: r.coordenador?.nome ?? null,
  }));
}

export async function getClienteById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(`
      *,
      assessor:profiles!clients_assessor_id_fkey(id, nome),
      coordenador:profiles!clients_coordenador_id_fkey(id, nome)
    `)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function getClientesStats() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("status, valor_mensal");
  if (error) throw error;

  const ativos = (data ?? []).filter((c) => c.status === "ativo");
  return {
    total_ativos: ativos.length,
    total_churn: (data ?? []).filter((c) => c.status === "churn").length,
    carteira_total: ativos.reduce((sum, c) => sum + Number(c.valor_mensal), 0),
  };
}
