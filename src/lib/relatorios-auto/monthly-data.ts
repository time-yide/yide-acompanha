import "server-only";
import { _getKpisImpl, _getCarteiraPorAssessorImpl, _getEntradaChurnImpl } from "@/lib/dashboard/queries";
import type { KpiData, AssessorCarteira, EntradaChurnPoint } from "@/lib/dashboard/queries";

export interface MonthlyData {
  mesRef: string;
  kpis: KpiData;
  carteiraPorAssessor: AssessorCarteira[];
  entradaChurn: EntradaChurnPoint[];
}

export async function getMonthlyData(mesRef: string): Promise<MonthlyData> {
  const [kpis, carteiraPorAssessor, entradaChurn] = await Promise.all([
    _getKpisImpl(undefined, mesRef),
    _getCarteiraPorAssessorImpl(undefined, mesRef),
    _getEntradaChurnImpl(3, undefined, mesRef),
  ]);

  return { mesRef, kpis, carteiraPorAssessor, entradaChurn };
}
