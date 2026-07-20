import { describe, it, expect } from "vitest";
import { createClienteSchema, churnClienteSchema } from "@/lib/clientes/schema";

describe("createClienteSchema", () => {
  it("aceita cliente válido mínimo", () => {
    const r = createClienteSchema.safeParse({ nome: "Padaria Doce Vida" });
    expect(r.success).toBe(true);
  });

  it("aceita valor_mensal como string e converte", () => {
    const r = createClienteSchema.safeParse({ nome: "Padaria", valor_mensal: "5500" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.valor_mensal).toBe(5500);
  });

  it("rejeita nome curto", () => {
    expect(createClienteSchema.safeParse({ nome: "X" }).success).toBe(false);
  });

  it("aceita email vazio", () => {
    const r = createClienteSchema.safeParse({ nome: "Padaria Legal", email: "" });
    expect(r.success).toBe(true);
  });

  it("rejeita email malformado", () => {
    const r = createClienteSchema.safeParse({ nome: "Padaria Legal", email: "abc" });
    expect(r.success).toBe(false);
  });
});

describe("churnClienteSchema", () => {
  const ID = "00000000-0000-0000-0000-000000000000";

  it("exige categoria de motivo", () => {
    const r = churnClienteSchema.safeParse({ id: ID, motivo_churn: "detalhe" });
    expect(r.success).toBe(false);
  });

  it("rejeita categoria fora das opções", () => {
    const r = churnClienteSchema.safeParse({ id: ID, motivo_churn_categoria: "xyz" });
    expect(r.success).toBe(false);
  });

  it("aceita churn só com a categoria (detalhe opcional)", () => {
    const r = churnClienteSchema.safeParse({ id: ID, motivo_churn_categoria: "preco" });
    expect(r.success).toBe(true);
  });

  it("aceita categoria + detalhe de texto", () => {
    const r = churnClienteSchema.safeParse({
      id: ID,
      motivo_churn_categoria: "concorrente",
      motivo_churn: "foi pra agência X",
    });
    expect(r.success).toBe(true);
  });
});
