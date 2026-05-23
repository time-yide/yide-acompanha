// SERVER ONLY
import { cache } from "react";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getEffectiveUnitId } from "./session";

/**
 * Retorna a lista de profile_ids da unidade ATIVA do user atual.
 *
 * Usado pra filtrar tabelas que se relacionam com usuários (leads via
 * comercial_id, etc) por unidade. Quando profiles.unit_id ainda não
 * existe, retorna null = sem filtro.
 *
 * Cacheado por request via React.cache.
 */
export const getProfileIdsForActiveUnit = cache(async (): Promise<string[] | null> => {
  const unitId = await getEffectiveUnitId();
  if (!unitId) return null;

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const { data, error } = await sb
    .from("profiles")
    .select("id")
    .eq("unit_id", unitId);

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
});

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
 * Cacheado por request via React.cache.
 */
export const getClientIdsForActiveUnit = cache(async (): Promise<string[] | null> => {
  const unitId = await getEffectiveUnitId();
  if (!unitId) return null; // sem contexto de unidade, sem filtro

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
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
});
