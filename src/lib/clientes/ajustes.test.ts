import { describe, it, expect } from "vitest";
import { isClienteAtivoNaData, valorEfetivoCliente } from "./ajustes";

describe("isClienteAtivoNaData", () => {
  const ref = "2026-07-08";

  it("cliente já vigente conta", () => {
    expect(isClienteAtivoNaData({ data_entrada: "2026-01-01", data_churn: null }, ref)).toBe(true);
  });

  it("data_entrada no futuro NÃO conta (status ativo mas ainda não iniciou)", () => {
    expect(isClienteAtivoNaData({ data_entrada: "2026-08-01", data_churn: null }, ref)).toBe(false);
  });

  it("entrou exatamente na data de referência conta (limite inclusivo)", () => {
    expect(isClienteAtivoNaData({ data_entrada: ref, data_churn: null }, ref)).toBe(true);
  });

  it("churnou antes da data NÃO conta", () => {
    expect(isClienteAtivoNaData({ data_entrada: "2026-01-01", data_churn: "2026-06-30" }, ref)).toBe(false);
  });

  it("churnou exatamente na data NÃO conta (já saiu)", () => {
    expect(isClienteAtivoNaData({ data_entrada: "2026-01-01", data_churn: ref }, ref)).toBe(false);
  });

  it("churn futuro ainda conta como ativo", () => {
    expect(isClienteAtivoNaData({ data_entrada: "2026-01-01", data_churn: "2026-12-01" }, ref)).toBe(true);
  });
});

describe("valorEfetivoCliente", () => {
  const comum = { tipo_relacao: "comum" as const, valor_mensal: 3500 };

  it("comum sem ajuste = valor cheio", () => {
    expect(valorEfetivoCliente(comum, null)).toBe(3500);
  });

  it("parceria = 0", () => {
    expect(valorEfetivoCliente({ tipo_relacao: "parceria", valor_mensal: 3500 }, null)).toBe(0);
  });

  it("desconto_parcial subtrai", () => {
    expect(
      valorEfetivoCliente(comum, {
        id: "a",
        client_id: "c",
        mes_referencia: "2026-07",
        tipo: "desconto_parcial",
        valor_desconto: 500,
        motivo: "x",
        criado_por: "u",
        created_at: "2026-07-01",
      }),
    ).toBe(3000);
  });

  it("gratuidade_total = 0", () => {
    expect(
      valorEfetivoCliente(comum, {
        id: "a",
        client_id: "c",
        mes_referencia: "2026-07",
        tipo: "gratuidade_total",
        valor_desconto: null,
        motivo: "x",
        criado_por: "u",
        created_at: "2026-07-01",
      }),
    ).toBe(0);
  });
});
