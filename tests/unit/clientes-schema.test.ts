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
  it("exige motivo", () => {
    const r = churnClienteSchema.safeParse({
      id: "00000000-0000-0000-0000-000000000000",
      motivo_churn: "ab",
    });
    expect(r.success).toBe(false);
  });

  it("aceita churn com motivo", () => {
    const r = churnClienteSchema.safeParse({
      id: "00000000-0000-0000-0000-000000000000",
      motivo_churn: "Cliente saiu por preço",
    });
    expect(r.success).toBe(true);
  });
});
