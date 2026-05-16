// SERVER ONLY
import { cache } from "react";
import { cookies } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth, type CurrentUser } from "@/lib/auth/session";
import { listActiveUnits, getUnitBySlug } from "./queries";
import { ACTIVE_UNIT_COOKIE, isMasterRole, type Unit } from "./schema";

export interface UnitContext {
  /** Unidade "lar" do user (a do profile.unit_id). */
  homeUnit: Unit;
  /** Unidade que o user está VISUALIZANDO no momento. Pra non-master = homeUnit. */
  activeUnit: Unit;
  /** Lista de unidades acessíveis (todas pra master, só a própria pra non-master). */
  accessibleUnits: Unit[];
  /** Se este user pode alternar entre unidades. */
  isMaster: boolean;
  /** Sócio/adm logado pode estar visualizando outra unidade que não a sua de origem. */
  isViewingOtherUnit: boolean;
}

/**
 * Resolve qual unidade o user atual está VENDO no momento.
 *
 * - Non-master: sempre sua unidade de origem (cookie ignorado).
 * - Master: cookie ACTIVE_UNIT_COOKIE (slug). Fallback = home unit.
 *
 * Cacheado por request — uma chamada por render mesmo se chamado várias vezes.
 *
 * Server-only. Pra mostrar no cliente, passa via prop.
 */
export const getUnitContext = cache(async (): Promise<UnitContext | null> => {
  const user = await requireAuth();
  return resolveUnitContextForUser(user);
});

async function resolveUnitContextForUser(user: CurrentUser): Promise<UnitContext | null> {
  // Busca unit_id do user direto do banco (não está no CurrentUser ainda — Fase 1
  // não toca em requireAuth pra evitar regressão no resto do app).
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const { data: profileRow, error } = await sb
    .from("profiles")
    .select("unit_id")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !profileRow?.unit_id) {
    console.error("[units] resolveUnitContextForUser failed:", error);
    return null;
  }

  const units = await listActiveUnits();
  const homeUnit = units.find((u) => u.id === profileRow.unit_id);
  if (!homeUnit) return null;

  const master = isMasterRole(user.role);

  // Master pode visualizar outra unidade via cookie. Non-master sempre na home.
  let activeUnit = homeUnit;
  let isViewingOtherUnit = false;
  if (master) {
    const cookieStore = await cookies();
    const cookieSlug = cookieStore.get(ACTIVE_UNIT_COOKIE)?.value;
    if (cookieSlug && cookieSlug !== homeUnit.slug) {
      const target = await getUnitBySlug(cookieSlug);
      if (target && target.ativa) {
        activeUnit = target;
        isViewingOtherUnit = true;
      }
    }
  }

  return {
    homeUnit,
    activeUnit,
    accessibleUnits: master ? units : [homeUnit],
    isMaster: master,
    isViewingOtherUnit,
  };
}

/**
 * Helper canônico pra filtros: retorna o unit_id que deve filtrar os dados
 * nesta request. Fase 2+ vai começar a usar isso em queries de clients/tasks/etc.
 *
 * Convenção:
 * - Master visualizando "Todas" (futuro Fase 4): retornaria null = sem filtro
 * - Caso geral: retorna activeUnit.id
 */
export async function getEffectiveUnitId(): Promise<string | null> {
  const ctx = await getUnitContext();
  return ctx?.activeUnit.id ?? null;
}
