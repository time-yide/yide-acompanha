import { z } from "zod";

export const adjustmentSchema = z.object({
  snapshot_id: z.string().uuid(),
  novo_valor_variavel: z.coerce.number().min(0, "Valor não pode ser negativo"),
  justificativa: z.string().min(5, "Justificativa muito curta (mín. 5 chars)"),
});

export const approveSchema = z.object({
  mes_referencia: z.string().regex(/^\d{4}-\d{2}$/, "Mês inválido (use formato YYYY-MM)"),
});

export type AdjustmentInput = z.infer<typeof adjustmentSchema>;
export type ApproveInput = z.infer<typeof approveSchema>;

export type SnapshotItemTipo =
  | "fixo"
  | "carteira_assessor"
  | "carteira_coord_agencia"
  | "deal_fechado_comercial";

export interface SnapshotCalc {
  fixo: number;
  percentual_aplicado: number;
  base_calculo: number;
  valor_variavel: number;
}

export interface SnapshotItem {
  tipo: SnapshotItemTipo;
  descricao: string;
  base: number;
  percentual: number;
  valor: number;
  client_id?: string;
  lead_id?: string;
}

export interface CommissionResult {
  snapshot: SnapshotCalc;
  items: SnapshotItem[];
}
