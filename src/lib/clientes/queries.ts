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
  modalidade?: "mensal" | "pontual" | null;
  data_churn?: string | null;
  motivo_churn_categoria?: string | null;
  motivo_churn?: string | null;
  assessor_nome?: string | null;
  coordenador_nome?: string | null;
  /** Multi-tenant Fase 2. */
  unit_id?: string | null;
}

export interface ListClientesFilters {
  status?: "ativo" | "churn" | "em_onboarding";
  assessorId?: string;
  /** Filtra clientes onde o usuário é assessor OU coordenador. */
  responsibleUserId?: string;
  search?: string;
  /** "mensal" | "pontual" - vem do dashboard (drill-down em serviços pontuais). */
  modalidade?: "mensal" | "pontual";
  /** YYYY-MM - filtra clientes cujo data_churn cai dentro do mês informado.
   * Usado pelo drill-down do KPI "Churn do mês" no dashboard. */
  churnMonth?: string;
  /** Multi-tenant Fase 2: quando passado, restringe à unidade. Pra master
   *  pode ser null = consolidado (ver todas). Pra non-master, sempre a home.
   *  Pages devem passar via getEffectiveUnitId(). */
  unitId?: string | null;
}

async function _listClientesImpl(filters?: ListClientesFilters): Promise<ClienteRow[]> {
  // Usa service-role pra funcionar dentro de unstable_cache (sem request context).
  // RLS de SELECT em `clients` é permissiva (`using (true)` pra authenticated),
  // então o resultado é idêntico ao cookie-based.
  const supabase = createServiceRoleClient();
  // Cast via unknown porque os types gerados do Supabase ainda não conhecem
  // a coluna 'modalidade' (gerada após `npm run db:types` pós-migration).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from("clients")
    .select(`
      id, nome, email, telefone, valor_mensal, servico_contratado, status, data_entrada,
      assessor_id, coordenador_id, tipo_relacao, modalidade, data_churn, unit_id,
      motivo_churn_categoria, motivo_churn,
      assessor:profiles!clients_assessor_id_fkey(nome),
      coordenador:profiles!clients_coordenador_id_fkey(nome)
    `)
    .is("deleted_at", null)
    .order("nome");

  // Filtro de unidade (Fase 2). unitId === null → consolidado (não filtra).
  if (filters?.unitId) query = query.eq("unit_id", filters.unitId);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.assessorId) query = query.eq("assessor_id", filters.assessorId);
  if (filters?.responsibleUserId) {
    query = query.or(
      `assessor_id.eq.${filters.responsibleUserId},coordenador_id.eq.${filters.responsibleUserId}`,
    );
  }
  if (filters?.search) query = query.ilike("nome", `%${filters.search}%`);
  if (filters?.modalidade) {
    // Modalidade "mensal" inclui rows com NULL (default histórico antes da migration).
    if (filters.modalidade === "mensal") {
      query = query.or("modalidade.is.null,modalidade.eq.mensal");
    } else {
      query = query.eq("modalidade", filters.modalidade);
    }
  }
  if (filters?.churnMonth) {
    // YYYY-MM → range [YYYY-MM-01, próximo mês-01)
    const [yyyy, mm] = filters.churnMonth.split("-").map((n) => parseInt(n, 10));
    if (!Number.isNaN(yyyy) && !Number.isNaN(mm)) {
      const start = `${yyyy}-${String(mm).padStart(2, "0")}-01`;
      const nextYear = mm === 12 ? yyyy + 1 : yyyy;
      const nextMonth = mm === 12 ? 1 : mm + 1;
      const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
      query = query.gte("data_churn", start).lt("data_churn", end);
    }
  }

  const { data, error } = await query;
  if (error) {
    // Fallback: se a coluna 'modalidade' ou 'data_churn' não existir (schema
    // ainda não migrado em algum ambiente), tenta de novo sem essas refs.
    const msg = String((error as { message?: string })?.message ?? "");
    if (msg.includes("modalidade") || msg.includes("data_churn") || msg.includes("schema cache")) {
      const retry = await supabase
        .from("clients")
        .select(`
          id, nome, email, telefone, valor_mensal, servico_contratado, status, data_entrada,
          assessor_id, coordenador_id, tipo_relacao,
          assessor:profiles!clients_assessor_id_fkey(nome),
          coordenador:profiles!clients_coordenador_id_fkey(nome)
        `)
        .is("deleted_at", null)
        .order("nome");
      if (retry.error) throw retry.error;
      type RawRowFallback = ClienteRow & {
        assessor?: { nome: string } | null;
        coordenador?: { nome: string } | null;
      };
      return ((retry.data ?? []) as unknown as RawRowFallback[]).map((r) => ({
        ...r,
        valor_mensal: Number(r.valor_mensal),
        assessor_nome: r.assessor?.nome ?? null,
        coordenador_nome: r.coordenador?.nome ?? null,
      }));
    }
    throw error;
  }
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
    // v3: shape ganhou unit_id + filtro novo (multi-tenant Fase 2)
    // v4: shape ganhou motivo_churn_categoria + motivo_churn (edição inline do motivo)
    ["clientes-list-v4"],
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

async function _getClientesStatsImpl(unitId: string | null) {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from("clients")
    .select("status, valor_mensal")
    .is("deleted_at", null);
  // Multi-tenant Fase 2: filtra por unidade quando passado.
  // Fallback: se a coluna unit_id ainda não existir (migration não rodada),
  // o erro é capturado e retorna stats consolidadas (legado).
  if (unitId) query = query.eq("unit_id", unitId);

  const { data, error } = await query;
  if (error) {
    const msg = String(error.message ?? "");
    if (msg.includes("unit_id") || msg.includes("schema cache")) {
      console.warn("[clientes] stats fallback sem unit_id:", msg);
      const retry = await supabase
        .from("clients")
        .select("status, valor_mensal")
        .is("deleted_at", null);
      if (retry.error) throw retry.error;
      const rows = (retry.data ?? []) as Array<{ status: string; valor_mensal: number | string }>;
      const ativos = rows.filter((c) => c.status === "ativo");
      return {
        total_ativos: ativos.length,
        total_churn: rows.filter((c) => c.status === "churn").length,
        carteira_total: ativos.reduce((sum, c) => sum + Number(c.valor_mensal), 0),
      };
    }
    throw error;
  }

  const ativos = (data ?? []).filter((c: { status: string }) => c.status === "ativo");
  return {
    total_ativos: ativos.length,
    total_churn: (data ?? []).filter((c: { status: string }) => c.status === "churn").length,
    carteira_total: ativos.reduce(
      (sum: number, c: { valor_mensal: number | string }) => sum + Number(c.valor_mensal),
      0,
    ),
  };
}

export async function getClientesStats(unitId?: string | null) {
  const cached = unstable_cache(
    async (uid: string) => {
      const u = uid === "" ? null : uid;
      return _getClientesStatsImpl(u);
    },
    // v2: cache key inclui unitId pra master ver stats diferentes por unidade
    ["clientes-stats-v2"],
    { revalidate: 60, tags: ["clients"] },
  );
  return cached(unitId ?? "");
}
