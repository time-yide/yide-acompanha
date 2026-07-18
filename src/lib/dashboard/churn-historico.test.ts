import { describe, it, expect } from "vitest";
import { computeChurnMensal, type ChurnClientRow } from "./churn-historico";

const clients: ChurnClientRow[] = [
  { data_entrada: "2026-01-01", data_churn: "2026-03-15", valor_mensal: 1000, modalidade: "mensal", tipo_relacao: "comum" }, // A: churn março
  { data_entrada: "2026-01-01", data_churn: null, valor_mensal: 500, modalidade: "mensal", tipo_relacao: "comum" },           // B: ativo
  { data_entrada: "2026-01-10", data_churn: null, valor_mensal: 500, modalidade: null, tipo_relacao: null },                  // C: ativo (defaults = mensal/comum)
  { data_entrada: "2026-02-01", data_churn: null, valor_mensal: 500, modalidade: "mensal", tipo_relacao: "comum" },           // F: entra em fev
  { data_entrada: "2026-01-01", data_churn: "2026-03-10", valor_mensal: 9999, modalidade: "pontual", tipo_relacao: "comum" }, // D: pontual → fora
  { data_entrada: "2026-01-01", data_churn: "2026-03-05", valor_mensal: 9999, modalidade: "mensal", tipo_relacao: "parceria" }, // E: parceria → fora
];

describe("computeChurnMensal", () => {
  const pts = computeChurnMensal(clients, ["2026-01", "2026-02", "2026-03"]);
  const byMes = Object.fromEntries(pts.map((p) => [p.mes, p]));

  it("mês inicial sem base → churnPct null", () => {
    expect(byMes["2026-01"]).toEqual({ mes: "2026-01", churnPct: null, churns: 0, valorPerdido: 0 });
  });

  it("mês sem churn → 0%", () => {
    expect(byMes["2026-02"]).toEqual({ mes: "2026-02", churnPct: 0, churns: 0, valorPerdido: 0 });
  });

  it("churn% = saídas ÷ base do mês anterior; só mensal comum", () => {
    expect(byMes["2026-03"]).toEqual({ mes: "2026-03", churnPct: 25, churns: 1, valorPerdido: 1000 });
  });

  it("pontual e parceria não entram na conta", () => {
    expect(byMes["2026-03"].churns).toBe(1);
    expect(byMes["2026-03"].valorPerdido).toBe(1000);
  });

  it("sem meses → array vazio", () => {
    expect(computeChurnMensal(clients, [])).toEqual([]);
  });
});
