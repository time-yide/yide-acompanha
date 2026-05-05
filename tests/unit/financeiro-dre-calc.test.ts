import { describe, it, expect } from "vitest";
import {
  expenseAplicaNoMes,
  valorNoMes,
  calcMargem,
  type ExpenseRow,
  type OverrideRow,
} from "@/lib/financeiro/dre-calc";

function expense(o: Partial<ExpenseRow> = {}): ExpenseRow {
  return {
    id: o.id ?? "e1",
    descricao: "Aluguel",
    categoria: "aluguel",
    tipo: o.tipo ?? "fixa",
    valor: o.valor ?? 5000,
    mes_referencia: o.mes_referencia ?? null,
    inicio_mes: o.inicio_mes ?? null,
    fim_mes: o.fim_mes ?? null,
  };
}

describe("expenseAplicaNoMes", () => {
  it("avulsa aplica só no mes_referencia", () => {
    const e = expense({ tipo: "avulsa", mes_referencia: "2026-05" });
    expect(expenseAplicaNoMes(e, "2026-05")).toBe(true);
    expect(expenseAplicaNoMes(e, "2026-04")).toBe(false);
    expect(expenseAplicaNoMes(e, "2026-06")).toBe(false);
  });

  it("fixa sem início/fim aplica em qualquer mês", () => {
    const e = expense({ tipo: "fixa" });
    expect(expenseAplicaNoMes(e, "2026-01")).toBe(true);
    expect(expenseAplicaNoMes(e, "2030-12")).toBe(true);
  });

  it("fixa com inicio_mes não aplica antes", () => {
    const e = expense({ tipo: "fixa", inicio_mes: "2026-05" });
    expect(expenseAplicaNoMes(e, "2026-04")).toBe(false);
    expect(expenseAplicaNoMes(e, "2026-05")).toBe(true);
    expect(expenseAplicaNoMes(e, "2026-06")).toBe(true);
  });

  it("fixa com fim_mes não aplica a partir dele (exclusivo)", () => {
    const e = expense({ tipo: "fixa", inicio_mes: "2026-01", fim_mes: "2026-06" });
    expect(expenseAplicaNoMes(e, "2026-05")).toBe(true);
    expect(expenseAplicaNoMes(e, "2026-06")).toBe(false);
    expect(expenseAplicaNoMes(e, "2026-07")).toBe(false);
  });
});

describe("valorNoMes", () => {
  it("usa valor padrão quando não tem override", () => {
    const e = expense({ valor: 5000 });
    expect(valorNoMes(e, "2026-05", [])).toBe(5000);
  });

  it("usa valor do override quando existe pra esse mês", () => {
    const e = expense({ id: "e1", valor: 5000 });
    const overrides: OverrideRow[] = [
      { id: "o1", expense_id: "e1", mes_referencia: "2026-05", valor: 5500 },
    ];
    expect(valorNoMes(e, "2026-05", overrides)).toBe(5500);
  });

  it("ignora override de outro mês", () => {
    const e = expense({ id: "e1", valor: 5000 });
    const overrides: OverrideRow[] = [
      { id: "o1", expense_id: "e1", mes_referencia: "2026-04", valor: 4500 },
    ];
    expect(valorNoMes(e, "2026-05", overrides)).toBe(5000);
  });

  it("ignora override de outra expense", () => {
    const e = expense({ id: "e1", valor: 5000 });
    const overrides: OverrideRow[] = [
      { id: "o1", expense_id: "e2", mes_referencia: "2026-05", valor: 9999 },
    ];
    expect(valorNoMes(e, "2026-05", overrides)).toBe(5000);
  });
});

describe("calcMargem", () => {
  it("retorna 0 quando denom é 0", () => {
    expect(calcMargem(100, 0)).toBe(0);
  });
  it("retorna proporção", () => {
    expect(calcMargem(50, 100)).toBe(0.5);
  });
  it("aceita lucro negativo", () => {
    expect(calcMargem(-50, 100)).toBe(-0.5);
  });
});
