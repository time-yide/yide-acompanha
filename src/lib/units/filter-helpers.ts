// SERVER ONLY
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getEffectiveUnitId } from "./session";

/**
 * Cache entre requests (não só por request) da lista de profile_ids por unidade.
 * Chave por unitId. Invalida via tag "unit-context" (mutações de cliente/
 * colaborador) + TTL de 60s de segurança. Query só service-role (sem cookies)
 * pra poder viver dentro do unstable_cache no Next 16.
 */
function profileIdsForUnitCached(unitId: string): Promise<string[] | null> {
  return unstable_cache(
    async (): Promise<string[] | null> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = createServiceRoleClient() as any;
      const { data, error } = await sb.from("profiles").select("id").eq("unit_id", unitId);
      if (error) {
        const msg = String(error.message ?? "");
        if (msg.includes("unit_id") || msg.includes("schema cache")) {
          console.warn("[units/filter-helpers] profiles.unit_id não existe:", msg);
          return null;
        }
        console.error("[units/filter-helpers] getProfileIdsForActiveUnit failed:", error);
        return null;
      }
      return (data ?? []).map((r: { id: string }) => r.id);
    },
    ["unit-profile-ids", unitId],
    { revalidate: 60, tags: ["unit-context", `unit-context-${unitId}`] },
  )();
}

/**
 * Retorna a lista de profile_ids da unidade ATIVA do user atual.
 *
 * Usado pra filtrar tabelas que se relacionam com usuários (leads via
 * comercial_id, etc) por unidade. Quando profiles.unit_id ainda não
 * existe, retorna null = sem filtro.
 *
 * React.cache dedupe por request; unstable_cache persiste entre requests.
 */
export const getProfileIdsForActiveUnit = cache(async (): Promise<string[] | null> => {
  const unitId = await getEffectiveUnitId();
  if (!unitId) return null;
  return profileIdsForUnitCached(unitId);
});

/**
 * Cache entre requests da lista de client_ids por unidade. Mesma estratégia do
 * profileIds acima (chave por unitId, tag "unit-context" + TTL 60s).
 */
function clientIdsForUnitCached(unitId: string): Promise<string[] | null> {
  return unstable_cache(
    async (): Promise<string[] | null> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = createServiceRoleClient() as any;
      const { data, error } = await sb
        .from("clients")
        .select("id")
        .eq("unit_id", unitId)
        .is("deleted_at", null);
      if (error) {
        const msg = String(error.message ?? "");
        // Migration de unit_id ainda não rodada - retorna null (sem filtro)
        if (msg.includes("unit_id") || msg.includes("schema cache")) {
          console.warn("[units/filter-helpers] clients.unit_id não existe, fallback sem filtro:", msg);
          return null;
        }
        console.error("[units/filter-helpers] getClientIdsForActiveUnit failed:", error);
        return null;
      }
      return (data ?? []).map((r: { id: string }) => r.id);
    },
    ["unit-client-ids", unitId],
    { revalidate: 60, tags: ["unit-context", `unit-context-${unitId}`] },
  )();
}

/**
 * Retorna a lista de client_ids da unidade ATIVA do user atual.
 *
 * Usado pra filtrar tabelas que se relacionam com clientes (tasks, leads,
 * capturas, posts, artes, etc) por unidade. Faz uma query indireta:
 *
 *   1. Resolve unit_id ativo (cookie ou home)
 *   2. SELECT id FROM clients WHERE unit_id = X
 *   3. Caller usa o array em .in("client_id", ids)
 *
 * Quando a coluna `clients.unit_id` não existe ainda (migration não rodada),
 * retorna null pra sinalizar "sem filtro" (mostra tudo, fallback safe).
 *
 * Quando o filtro tem ZERO clientes (unidade nova), retorna [] - caller
 * deve interpretar como "esconda tudo".
 *
 * React.cache dedupe por request; unstable_cache persiste entre requests.
 */
export const getClientIdsForActiveUnit = cache(async (): Promise<string[] | null> => {
  const unitId = await getEffectiveUnitId();
  if (!unitId) return null; // sem contexto de unidade, sem filtro
  return clientIdsForUnitCached(unitId);
});
