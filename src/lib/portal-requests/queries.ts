import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { RequestRow, Status } from "./schema";

const SELECT_FIELDS =
  "id, client_id, created_by_user_id, created_by_nome, titulo, descricao, categoria, status, prioridade, resposta, resolvido_por, resolvido_em, created_at, updated_at";

/** Lista solicitações de um cliente (portal). Ordena: aberta/andamento primeiro, depois data desc. */
export async function listRequestsByClient(clientId: string): Promise<RequestRow[]> {
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { data, error } = await sbAny
    .from("client_portal_requests")
    .select(SELECT_FIELDS)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as RequestRow[];
}

export interface RequestWithCliente extends RequestRow {
  cliente_nome: string;
}

/**
 * Lista TODAS as solicitações pra equipe interna (filtros opcionais).
 * Inclui nome do cliente pra mostrar na tabela.
 */
export async function listAllRequests(filters?: {
  status?: Status[];
  clientId?: string;
}): Promise<RequestWithCliente[]> {
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  let query = sbAny
    .from("client_portal_requests")
    .select(`${SELECT_FIELDS}, cliente:clients(nome)`)
    .order("created_at", { ascending: false });

  if (filters?.status && filters.status.length > 0) {
    query = query.in("status", filters.status);
  }
  if (filters?.clientId) {
    query = query.eq("client_id", filters.clientId);
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as Array<RequestRow & { cliente?: { nome: string } | null }>;
  return rows.map((r) => ({
    ...r,
    cliente_nome: r.cliente?.nome ?? "(cliente removido)",
  }));
}

export interface RequestDetail extends RequestRow {
  cliente_nome: string;
  resolvido_por_nome: string | null;
}

export async function getRequestById(id: string): Promise<RequestDetail | null> {
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { data, error } = await sbAny
    .from("client_portal_requests")
    .select(`${SELECT_FIELDS}, cliente:clients(nome), resolvedor:profiles!client_portal_requests_resolvido_por_fkey(nome)`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as RequestRow & {
    cliente?: { nome: string } | null;
    resolvedor?: { nome: string } | null;
  };
  return {
    ...row,
    cliente_nome: row.cliente?.nome ?? "(cliente removido)",
    resolvido_por_nome: row.resolvedor?.nome ?? null,
  };
}

/** Contagem rápida pra badge no menu/dashboard interno. */
export async function countRequestsAbertas(): Promise<number> {
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { count } = await sbAny
    .from("client_portal_requests")
    .select("id", { count: "exact", head: true })
    .in("status", ["aberta", "em_andamento"]);
  return count ?? 0;
}
