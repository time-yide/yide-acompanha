import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getTodayDate } from "@/lib/datetime/timezone";
import { resolverSemana } from "@/lib/check/core";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export interface VistoriaLockState {
  /** true = tem equipamento com a pessoa e a conferência da semana ainda não foi concluída. */
  blocked: boolean;
  total: number;
}

/**
 * Trava semanal: quem tem equipamento com ele precisa concluir a conferência da
 * semana (segunda em diante) antes de usar o sistema. Sem equipamento = livre.
 */
export async function checkVistoriaLock(userId: string): Promise<VistoriaLockState> {
  const sb = createServiceRoleClient() as SB;
  const { count: total } = await sb
    .from("equipamentos")
    .select("id", { count: "exact", head: true })
    .eq("responsavel_id", userId)
    .neq("status", "baixado");
  if (!total) return { blocked: false, total: 0 };

  const semana = resolverSemana(null, getTodayDate());
  const { data: vistoria } = await sb
    .from("vistorias")
    .select("concluida_em")
    .eq("responsavel_id", userId)
    .eq("semana_inicio", semana)
    .maybeSingle();

  return { blocked: !vistoria?.concluida_em, total };
}
