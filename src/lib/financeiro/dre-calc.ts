import type { ExpenseCategoria, ExpenseTipo } from "./schema";

export interface ExpenseRow {
  id: string;
  descricao: string;
  categoria: ExpenseCategoria;
  tipo: ExpenseTipo;
  valor: number;
  mes_referencia: string | null;
  inicio_mes: string | null;
  fim_mes: string | null;
}

export interface OverrideRow {
  id: string;
  expense_id: string;
  mes_referencia: string;
  valor: number;
}

/** True se a despesa se aplica ao mes (formato YYYY-MM). */
export function expenseAplicaNoMes(e: ExpenseRow, mesRef: string): boolean {
  if (e.tipo === "avulsa") {
    return e.mes_referencia === mesRef;
  }
  // fixa
  if (e.inicio_mes && mesRef < e.inicio_mes) return false;
  if (e.fim_mes && mesRef >= e.fim_mes) return false;
  return true;
}

/** Valor da despesa naquele mês - usa override se existir, senão valor padrão. */
export function valorNoMes(e: ExpenseRow, mesRef: string, overrides: OverrideRow[]): number {
  const ov = overrides.find((o) => o.expense_id === e.id && o.mes_referencia === mesRef);
  return ov ? Number(ov.valor) : Number(e.valor);
}

/** Margem como proporção (0 quando denom=0, pra evitar divisão por zero). */
export function calcMargem(num: number, denom: number): number {
  if (denom === 0) return 0;
  return num / denom;
}
