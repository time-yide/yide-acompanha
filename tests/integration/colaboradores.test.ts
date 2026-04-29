import { describe, it, expect } from "vitest";
import { createColaboradorSchema } from "@/lib/colaboradores/schema";

describe("createColaboradorSchema", () => {
  it("aceita convite válido com todos os campos", () => {
    const result = createColaboradorSchema.safeParse({
      nome: "João Silva",
      email: "joao@yide.com",
      role: "assessor",
      fixo_mensal: "3000",
      comissao_percent: "5",
      comissao_primeiro_mes_percent: "0",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita email inválido", () => {
    const result = createColaboradorSchema.safeParse({
      nome: "João Silva",
      email: "não-é-email",
      role: "assessor",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita comissão > 100%", () => {
    const result = createColaboradorSchema.safeParse({
      nome: "João",
      email: "j@y.com",
      role: "assessor",
      comissao_percent: "150",
    });
    expect(result.success).toBe(false);
  });

  it("aceita role 'comercial'", () => {
    const result = createColaboradorSchema.safeParse({
      nome: "Roberta",
      email: "roberta@yide.com",
      role: "comercial",
      comissao_primeiro_mes_percent: "25",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita role inválido", () => {
    const result = createColaboradorSchema.safeParse({
      nome: "X",
      email: "x@y.com",
      role: "papel-inexistente",
    });
    expect(result.success).toBe(false);
  });
});
