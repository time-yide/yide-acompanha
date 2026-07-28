// SERVER ONLY
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Unit } from "./schema";

/** Tag de invalidação do cache de unidades (ver units/actions.ts). */
export const UNITS_CACHE_TAG = "units";

// Data Cache: units quase nunca mudam, mas eram lidas do banco em TODA página
// autenticada (caminho crítico do contexto de unidade). Cacheia cross-request e
// invalida por tag quando cria/edita unidade. React.cache por cima = 1 leitura por render.
const _listUnitsCached = unstable_cache(
  async (): Promise<Unit[]> => {
    const admin = createServiceRoleClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = admin as any;
    const { data, error } = await sb
      .from("units")
      .select("id, nome, slug, ativa, endereco, cnpj, cor_destaque")
      .order("ativa", { ascending: false })
      .order("nome");
    if (error) {
      // Defensivo: se tabela ainda não existe (migration não rodada), devolve vazio.
      console.error("[units] listUnits failed:", error);
      return [];
    }
    return (data ?? []) as Unit[];
  },
  ["units-all"],
  { tags: [UNITS_CACHE_TAG], revalidate: 3600 },
);

/** Lista todas as unidades. Data Cache (tag `units`) + dedup por request. */
export const listUnits = cache(async (): Promise<Unit[]> => _listUnitsCached());

/** Lista apenas unidades ativas - usado no seletor da TopBar. */
export const listActiveUnits = cache(async (): Promise<Unit[]> => {
  const all = await listUnits();
  return all.filter((u) => u.ativa);
});

/** Busca uma unidade por id. Útil pra renderizar nome/slug. */
export async function getUnitById(id: string): Promise<Unit | null> {
  const units = await listUnits();
  return units.find((u) => u.id === id) ?? null;
}

/** Busca uma unidade por slug - usado pra mapear cookie → unit_id. */
export async function getUnitBySlug(slug: string): Promise<Unit | null> {
  const units = await listUnits();
  return units.find((u) => u.slug === slug) ?? null;
}
