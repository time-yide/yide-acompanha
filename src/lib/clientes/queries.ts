import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

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
  tipo_relacao: "comum" | "parceria" | "permuta";
  assessor_nome?: string | null;
  coordenador_nome?: string | null;
}

export interface ListClientesFilters {
  status?: "ativo" | "churn" | "em_onboarding";
  assessorId?: string;
  /** Filtra clientes onde o usuário é assessor OU coordenador. */
  responsibleUserId?: string;
  search?: string;
}

async function _listClientesImpl(filters?: ListClientesFilters): Promise<ClienteRow[]> {
  // Usa service-role pra funcionar dentro de unstable_cache (sem request context).
  // RLS de SELECT em `clients` é permissiva (`using (true)` pra authenticated),
  // então o resultado é idêntico ao cookie-based.
  const supabase = createServiceRoleClient();
  let query = supabase
    .from("clients")
    .select(`
      id, nome, email, telefone, valor_mensal, servico_contratado, status, data_entrada,
      assessor_id, coordenador_id, tipo_relacao,
      assessor:profiles!clients_assessor_id_fkey(nome),
      coordenador:profiles!clients_coordenador_id_fkey(nome)
    `)
    .is("deleted_at", null)
    .order("nome");

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.assessorId) query = query.eq("assessor_id", filters.assessorId);
  if (filters?.responsibleUserId) {
    query = query.or(
      `assessor_id.eq.${filters.responsibleUserId},coordenador_id.eq.${filters.responsibleUserId}`,
    );
  }
  if (filters?.search) query = query.ilike("nome", `%${filters.search}%`);

  const { data, error } = await query;
  if (error) throw error;
  type RawRow = ClienteRow & {
    assessor?: { nome: string } | null;
    coordenador?: { nome: string } | null;
  };
  return ((data ?? []) as unknown as RawRow[]).map((r) => ({
    ...r,
    valor_mensal: Number(r.valor_mensal),
    assessor_nome: r.assessor?.nome ?? null,
    coordenador_nome: r.coordenador?.nome ?? null,
  }));
}

export async function listClientes(filters?: ListClientesFilters): Promise<ClienteRow[]> {
  const cached = unstable_cache(
    async (filtersJson: string) => {
      const f = filtersJson !== "null" ? (JSON.parse(filtersJson) as ListClientesFilters) : undefined;
      return _listClientesImpl(f);
    },
    ["clientes-list"],
    { revalidate: 60, tags: ["clients"] },
  );
  return cached(JSON.stringify(filters ?? null));
}

export async function getClienteById(id: string) {
  // Não cacheado: detalhe muda mais frequentemente que a lista, e revalidação
  // por id seria mais granular. Simples assim por enquanto.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(`
      *,
      assessor:profiles!clients_assessor_id_fkey(id, nome),
      coordenador:profiles!clients_coordenador_id_fkey(id, nome)
    `)
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (error) throw error;
  return data;
}

async function _getClientesStatsImpl() {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("clients")
    .select("status, valor_mensal")
    .is("deleted_at", null);
  if (error) throw error;

  const ativos = (data ?? []).filter((c) => c.status === "ativo");
  return {
    total_ativos: ativos.length,
    total_churn: (data ?? []).filter((c) => c.status === "churn").length,
    carteira_total: ativos.reduce((sum, c) => sum + Number(c.valor_mensal), 0),
  };
}

export async function getClientesStats() {
  const cached = unstable_cache(
    async () => _getClientesStatsImpl(),
    ["clientes-stats"],
    { revalidate: 60, tags: ["clients"] },
  );
  return cached();
}
