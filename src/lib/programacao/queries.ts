// SERVER ONLY
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { tipoLabel } from "./tipos";

export const CHEFIA_ROLES = ["adm", "socio"] as const;
export function veTudo(role: string): boolean {
  return (CHEFIA_ROLES as readonly string[]).includes(role);
}

export interface ClienteOption {
  id: string;
  nome: string;
}

/** Clientes ativos (não deletados) da organização, pro dropdown. */
export async function listClientesAtivos(orgId: string): Promise<ClienteOption[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data, error } = await sb
    .from("clients")
    .select("id, nome")
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .order("nome");
  if (error) {
    console.error("[programacao] listClientesAtivos", error.message);
    return [];
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    nome: r.nome as string,
  }));
}

export interface LancamentoRow {
  id: string;
  data: string;
  tipo: string;
  tipo_label: string;
  quantidade: number;
  observacao: string | null;
  colaborador_id: string | null;
  colaborador_nome: string | null;
  client_id: string;
  client_nome: string | null;
  created_at: string;
}

export interface ListLancamentosFilters {
  de?: string | null;
  ate?: string | null;
}

/** Lista lançamentos por período. Escopo: veTudo vê todos; senão só os próprios. */
export async function listLancamentos(
  orgId: string,
  role: string,
  actorId: string,
  filters: ListLancamentosFilters = {},
): Promise<LancamentoRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  let q = sb
    .from("lancamentos_programacao")
    .select(
      "id, data, tipo, quantidade, observacao, colaborador_id, client_id, created_at, " +
        "colaborador:profiles!lancamentos_programacao_colaborador_id_fkey(nome), " +
        "client:clients!lancamentos_programacao_client_id_fkey(nome)",
    )
    .eq("organization_id", orgId)
    .is("arquivado_em", null);

  if (!veTudo(role)) q = q.eq("colaborador_id", actorId);
  if (filters.de) q = q.gte("data", filters.de);
  if (filters.ate) q = q.lte("data", filters.ate);
  q = q.order("data", { ascending: false }).order("created_at", { ascending: false });

  const { data, error } = await q;
  if (error) {
    console.error("[programacao] listLancamentos", error.message);
    return [];
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    data: r.data as string,
    tipo: r.tipo as string,
    tipo_label: tipoLabel(r.tipo as string),
    quantidade: Number(r.quantidade ?? 0),
    observacao: (r.observacao as string | null) ?? null,
    colaborador_id: (r.colaborador_id as string | null) ?? null,
    colaborador_nome: ((r.colaborador as { nome?: string } | null) ?? null)?.nome ?? null,
    client_id: r.client_id as string,
    client_nome: ((r.client as { nome?: string } | null) ?? null)?.nome ?? null,
    created_at: r.created_at as string,
  }));
}
