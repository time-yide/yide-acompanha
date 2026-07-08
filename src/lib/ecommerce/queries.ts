// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { AnuncioAggRow } from "./aggregate";

export const CHEFIA_ROLES = ["adm", "socio"] as const;
export function veTudo(role: string): boolean {
  return (CHEFIA_ROLES as readonly string[]).includes(role);
}

export interface ClienteEcommerceOption {
  id: string;
  nome: string;
}

/** Clientes com pacote e-commerce da organização, não arquivados. */
export async function listClientesEcommerce(
  orgId: string,
): Promise<ClienteEcommerceOption[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data, error } = await sb
    .from("clients")
    .select("id, nome")
    .eq("organization_id", orgId)
    .eq("tipo_pacote", "ecommerce")
    .is("deleted_at", null)
    .order("nome");
  if (error) {
    console.error("[ecommerce] listClientesEcommerce", error.message);
    return [];
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    nome: r.nome as string,
  }));
}

export interface AnuncioRow extends AnuncioAggRow {
  id: string;
  observacao: string | null;
  created_at: string;
}

export interface ListAnunciosFilters {
  de?: string | null; // YYYY-MM-DD
  ate?: string | null; // YYYY-MM-DD
  assessorId?: string | null;
}

/**
 * Lista lançamentos aplicando escopo por papel:
 * - veTudo(role): todos da org (com filtro opcional por assessor)
 * - senão: apenas os do próprio usuário (actorId)
 */
export async function listAnuncios(
  orgId: string,
  role: string,
  actorId: string,
  filters: ListAnunciosFilters = {},
): Promise<AnuncioRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  let q = sb
    .from("anuncios_ecommerce")
    .select(
      "id, data, quantidade, marketplace, observacao, colaborador_id, client_id, created_at, " +
        "colaborador:profiles!anuncios_ecommerce_colaborador_id_fkey(nome), " +
        "client:clients!anuncios_ecommerce_client_id_fkey(nome)",
    )
    .eq("organization_id", orgId)
    .is("arquivado_em", null);

  if (!veTudo(role)) {
    q = q.eq("colaborador_id", actorId);
  } else if (filters.assessorId) {
    q = q.eq("colaborador_id", filters.assessorId);
  }
  if (filters.de) q = q.gte("data", filters.de);
  if (filters.ate) q = q.lte("data", filters.ate);

  q = q.order("data", { ascending: false }).order("created_at", { ascending: false });

  const { data, error } = await q;
  if (error) {
    console.error("[ecommerce] listAnuncios", error.message);
    return [];
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    data: r.data as string,
    quantidade: Number(r.quantidade ?? 0),
    marketplace: r.marketplace as string,
    observacao: (r.observacao as string | null) ?? null,
    colaborador_id: (r.colaborador_id as string | null) ?? null,
    colaborador_nome:
      ((r.colaborador as { nome?: string } | null) ?? null)?.nome ?? null,
    client_id: r.client_id as string,
    client_nome: ((r.client as { nome?: string } | null) ?? null)?.nome ?? null,
    created_at: r.created_at as string,
  }));
}

export interface AssessorOption {
  id: string;
  nome: string;
}

/** Assessores de e-commerce ativos da org (para o filtro do painel). */
export async function listAssessoresEcommerce(): Promise<AssessorOption[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data, error } = await sb
    .from("profiles")
    .select("id, nome")
    .eq("role", "assessor_ecommerce")
    .eq("ativo", true)
    .order("nome");
  if (error) {
    console.error("[ecommerce] listAssessoresEcommerce", error.message);
    return [];
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    nome: r.nome as string,
  }));
}
