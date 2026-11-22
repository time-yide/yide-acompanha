// SERVER ONLY
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { CurrentUser } from "@/lib/auth/session";
import { CLIENTE_DADOS_SELECT, type ClienteDados } from "./calcular";
import { dadosVeTodos } from "./access";
import type { CanaisResultado, Perda } from "./tipos";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = () => createServiceRoleClient() as any;

export interface LinhaDados {
  clientId: string; nome: string; assessorId: string | null; assessorNome: string | null;
  nota: number | null; notaAnterior: number | null; canais: CanaisResultado | null;
  perdas: Perda[]; calculadoEm: string | null;
}

export type VisaoGeral = { ok: true; linhas: LinhaDados[] } | { ok: false; motivo: "sem_tabela" };

/** Clientes visíveis + snapshot mais recente de cada um (1 query por tabela, sem N+1). */
export async function listVisaoGeral(orgId: string, user: CurrentUser): Promise<VisaoGeral> {
  let q = sb().from("clients").select("id, nome, assessor_id")
    .eq("organization_id", orgId).in("status", ["ativo", "em_onboarding"]).is("deleted_at", null).order("nome");
  if (!dadosVeTodos(user.role)) q = q.eq("assessor_id", user.id);
  const { data: clientes, error: e1 } = await q;
  if (e1) { console.error("[dados/listVisaoGeral] clients", e1.message); return { ok: true, linhas: [] }; }
  const ids = ((clientes ?? []) as Array<{ id: string }>).map((c) => c.id);
  if (ids.length === 0) return { ok: true, linhas: [] };

  // Snapshots dos últimos 3 dias; fica o mais recente por cliente.
  const desde = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const { data: snaps, error: e2 } = await sb().from("client_dados_snapshots")
    .select("client_id, nota, nota_anterior, canais, perdas, calculado_em")
    .in("client_id", ids).gte("calculado_em", desde).order("calculado_em", { ascending: false });
  if (e2) {
    if (e2.code === "42P01" || e2.code === "PGRST205" || /client_dados_snapshots/.test(e2.message)) return { ok: false, motivo: "sem_tabela" };
    console.error("[dados/listVisaoGeral] snapshots", e2.message);
  }
  const assessorIds = [...new Set(((clientes ?? []) as Array<{ assessor_id: string | null }>).map((c) => c.assessor_id).filter(Boolean))];
  const { data: perfis } = assessorIds.length
    ? await sb().from("profiles").select("id, nome").in("id", assessorIds)
    : { data: [] };
  const nomeAssessor = new Map(((perfis ?? []) as Array<{ id: string; nome: string }>).map((p) => [p.id, p.nome]));

  const ultimo = new Map<string, Record<string, unknown>>();
  for (const s of (snaps ?? []) as Array<Record<string, unknown>>) if (!ultimo.has(s.client_id as string)) ultimo.set(s.client_id as string, s);

  const linhas = ((clientes ?? []) as Array<Record<string, unknown>>).map((c) => {
    const s = ultimo.get(c.id as string);
    return {
      clientId: c.id as string, nome: c.nome as string, assessorId: (c.assessor_id as string) ?? null,
      assessorNome: nomeAssessor.get(c.assessor_id as string) ?? null,
      nota: (s?.nota as number | null) ?? null, notaAnterior: (s?.nota_anterior as number | null) ?? null,
      canais: (s?.canais as CanaisResultado) ?? null, perdas: (s?.perdas as Perda[]) ?? [],
      calculadoEm: (s?.calculado_em as string) ?? null,
    };
  });
  return { ok: true, linhas };
}

/** Garante que o usuário pode ver o cliente. Devolve a linha do cliente (com conexões) ou null.
 *  Antes da migration (colunas ga4/gsc ausentes) refaz o select sem elas e devolve null nelas. */
export async function getClienteDados(orgId: string, user: CurrentUser, clientId: string) {
  const buscar = (cols: string) => sb().from("clients").select(`${cols}, assessor_id`)
    .eq("id", clientId).eq("organization_id", orgId).is("deleted_at", null).maybeSingle();
  let { data, error } = await buscar(CLIENTE_DADOS_SELECT);
  if (error && (error.code === "42703" || /ga4_property_id|gsc_site_url/.test(error.message ?? ""))) {
    const semNovas = CLIENTE_DADOS_SELECT.replace(", ga4_property_id, gsc_site_url", "");
    ({ data, error } = await buscar(semNovas));
    if (data) data = { ...data, ga4_property_id: null, gsc_site_url: null };
  }
  if (error) { console.error("[dados/getClienteDados]", error.message); return null; }
  if (!data) return null;
  if (!dadosVeTodos(user.role) && (data as { assessor_id: string | null }).assessor_id !== user.id) return null;
  return data as ClienteDados & { assessor_id: string | null };
}
