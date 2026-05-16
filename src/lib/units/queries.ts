// SERVER ONLY
import { cache } from "react";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Unit } from "./schema";

/** Lista todas as unidades. Cacheado por request (React.cache). */
export const listUnits = cache(async (): Promise<Unit[]> => {
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
});

/** Lista apenas unidades ativas — usado no seletor da TopBar. */
export const listActiveUnits = cache(async (): Promise<Unit[]> => {
  const all = await listUnits();
  return all.filter((u) => u.ativa);
});

/** Busca uma unidade por id. Útil pra renderizar nome/slug. */
export async function getUnitById(id: string): Promise<Unit | null> {
  const units = await listUnits();
  return units.find((u) => u.id === id) ?? null;
}

/** Busca uma unidade por slug — usado pra mapear cookie → unit_id. */
export async function getUnitBySlug(slug: string): Promise<Unit | null> {
  const units = await listUnits();
  return units.find((u) => u.slug === slug) ?? null;
}
