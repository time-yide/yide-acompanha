// SERVER ONLY: do not import from client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type TipoRelacao = "comum" | "parceria" | "permuta";
export type TipoAjuste = "desconto_parcial" | "gratuidade_total";

export interface MonthlyAdjustment {
  id: string;
  client_id: string;
  mes_referencia: string;
  tipo: TipoAjuste;
  valor_desconto: number | null;
  motivo: string;
  criado_por: string;
  created_at: string;
}

/**
 * Retorna o valor EFETIVO que um cliente paga no mês, considerando ajuste.
 * - parceria/permuta sempre: 0
 * - comum sem ajuste: valor_mensal
 * - comum com gratuidade_total: 0
 * - comum com desconto_parcial: max(0, valor_mensal - valor_desconto)
 */
export function valorEfetivoCliente(
  cliente: { tipo_relacao: TipoRelacao; valor_mensal: number },
  ajuste?: MonthlyAdjustment | null,
): number {
  if (cliente.tipo_relacao !== "comum") return 0;
  if (!ajuste) return Number(cliente.valor_mensal);
  if (ajuste.tipo === "gratuidade_total") return 0;
  if (ajuste.tipo === "desconto_parcial") {
    return Math.max(0, Number(cliente.valor_mensal) - Number(ajuste.valor_desconto ?? 0));
  }
  return Number(cliente.valor_mensal);
}

/**
 * Cliente está ativo na data X se já entrou (data_entrada <= X) e ainda não
 * churnou até X. Mesma semântica do KPI de carteira (dashboard/queries.ts:isActiveOn):
 * comissão conta só clientes já vigentes na data de referência — não os que
 * têm status='ativo' mas ainda vão iniciar (data_entrada no futuro).
 */
export function isClienteAtivoNaData(
  cliente: { data_entrada: string; data_churn: string | null },
  dateIso: string,
): boolean {
  if (cliente.data_entrada > dateIso) return false;
  if (cliente.data_churn && cliente.data_churn <= dateIso) return false;
  return true;
}

/** Carrega o ajuste de um mês pra um cliente (ou null se não tem). */
export async function getAjusteCliente(
  clientId: string,
  mesReferencia: string,
): Promise<MonthlyAdjustment | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("client_monthly_adjustments")
    .select("*")
    .eq("client_id", clientId)
    .eq("mes_referencia", mesReferencia)
    .maybeSingle();
  return (data as MonthlyAdjustment | null) ?? null;
}

/** Lista todos os ajustes de um mês (todos os clientes). */
export async function listAjustesMes(mesReferencia: string): Promise<MonthlyAdjustment[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("client_monthly_adjustments")
    .select("*")
    .eq("mes_referencia", mesReferencia);
  return (data ?? []) as MonthlyAdjustment[];
}
