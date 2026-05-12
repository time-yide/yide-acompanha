// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface ClienteCrmRow {
  id: string;
  nome: string;
  tipo_pacote: string;
  assessor_id: string | null;
  coordenador_id: string | null;
  crm_tipo: string | null;
  crm_url: string | null;
  crm_identifier: string | null;
  crm_observacoes: string | null;
}

interface ListFilter {
  assessorId?: string | null;
  coordenadorId?: string | null;
  searchQuery?: string;
  /** "todos" | "configurado" | "nao_configurado" | crmTipo específico */
  filtroCrm?: string;
}

export async function listClientesComCrm(filter: ListFilter = {}): Promise<ClienteCrmRow[]> {
  const supabase = createServiceRoleClient();

  // Helper com fallback caso colunas crm_* ainda não tenham sido migradas
  const buildQuery = (selectStr: string) => {
    let q = supabase
      .from("clients")
      .select(selectStr)
      .eq("status", "ativo");
    if (filter.assessorId) q = q.eq("assessor_id", filter.assessorId);
    if (filter.coordenadorId) q = q.eq("coordenador_id", filter.coordenadorId);
    if (filter.searchQuery && filter.searchQuery.trim()) {
      q = q.ilike("nome", `%${filter.searchQuery.trim()}%`);
    }
    return q.order("nome");
  };

  const SELECT_COMPLETO =
    "id, nome, tipo_pacote, assessor_id, coordenador_id, crm_tipo, crm_url, crm_identifier, crm_observacoes";
  const SELECT_FALLBACK = "id, nome, tipo_pacote, assessor_id, coordenador_id";

  let resp = await buildQuery(SELECT_COMPLETO);
  if (resp.error) {
    const msg = resp.error.message ?? "";
    if (msg.includes("crm_") || msg.includes("schema cache")) {
      console.warn("[crm] colunas crm_* indisponíveis — usando fallback");
      resp = await buildQuery(SELECT_FALLBACK);
    }
  }
  let clients = ((resp.data ?? []) as unknown as Array<{
    id: string;
    nome: string;
    tipo_pacote: string;
    assessor_id: string | null;
    coordenador_id: string | null;
    crm_tipo?: string | null;
    crm_url?: string | null;
    crm_identifier?: string | null;
    crm_observacoes?: string | null;
  }>);

  // Aplica filtro de CRM em memória (mais simples que SQL com OR/IS NULL)
  if (filter.filtroCrm && filter.filtroCrm !== "todos") {
    if (filter.filtroCrm === "configurado") {
      clients = clients.filter((c) => c.crm_tipo && c.crm_tipo !== "nenhum");
    } else if (filter.filtroCrm === "nao_configurado") {
      clients = clients.filter((c) => !c.crm_tipo || c.crm_tipo === "nenhum");
    } else {
      clients = clients.filter((c) => c.crm_tipo === filter.filtroCrm);
    }
  }

  return clients.map((c) => ({
    id: c.id,
    nome: c.nome,
    tipo_pacote: c.tipo_pacote,
    assessor_id: c.assessor_id,
    coordenador_id: c.coordenador_id,
    crm_tipo: c.crm_tipo ?? null,
    crm_url: c.crm_url ?? null,
    crm_identifier: c.crm_identifier ?? null,
    crm_observacoes: c.crm_observacoes ?? null,
  }));
}

export async function getClienteCrm(clientId: string): Promise<ClienteCrmRow | null> {
  const supabase = createServiceRoleClient();

  const buildQuery = (selectStr: string) =>
    supabase.from("clients").select(selectStr).eq("id", clientId).maybeSingle();

  const SELECT_COMPLETO =
    "id, nome, tipo_pacote, assessor_id, coordenador_id, crm_tipo, crm_url, crm_identifier, crm_observacoes";
  const SELECT_FALLBACK = "id, nome, tipo_pacote, assessor_id, coordenador_id";

  let resp = await buildQuery(SELECT_COMPLETO);
  if (resp.error) {
    const msg = resp.error.message ?? "";
    if (msg.includes("crm_") || msg.includes("schema cache")) {
      resp = await buildQuery(SELECT_FALLBACK);
    }
  }
  if (!resp.data) return null;
  const c = resp.data as unknown as {
    id: string;
    nome: string;
    tipo_pacote: string;
    assessor_id: string | null;
    coordenador_id: string | null;
    crm_tipo?: string | null;
    crm_url?: string | null;
    crm_identifier?: string | null;
    crm_observacoes?: string | null;
  };
  return {
    id: c.id,
    nome: c.nome,
    tipo_pacote: c.tipo_pacote,
    assessor_id: c.assessor_id,
    coordenador_id: c.coordenador_id,
    crm_tipo: c.crm_tipo ?? null,
    crm_url: c.crm_url ?? null,
    crm_identifier: c.crm_identifier ?? null,
    crm_observacoes: c.crm_observacoes ?? null,
  };
}
