import { describe, it, expect } from "vitest";
import { createPesquisaSchema, perguntaSchema, respostaValorSchema } from "./schema";

describe("createPesquisaSchema", () => {
  it("aceita título válido", () => {
    expect(createPesquisaSchema.safeParse({ titulo: "Clima", anonima: false }).success).toBe(true);
  });
  it("rejeita título curto", () => {
    expect(createPesquisaSchema.safeParse({ titulo: "", anonima: false }).success).toBe(false);
  });
});

describe("perguntaSchema", () => {
  it("múltipla escolha exige >=2 opções", () => {
    expect(
      perguntaSchema.safeParse({ tipo: "multipla_escolha", enunciado: "Q", opcoes: ["a"] }).success,
    ).toBe(false);
    expect(
      perguntaSchema.safeParse({ tipo: "multipla_escolha", enunciado: "Q", opcoes: ["a", "b"] }).success,
    ).toBe(true);
  });
  it("texto não precisa de opções", () => {
    expect(perguntaSchema.safeParse({ tipo: "texto", enunciado: "Comente" }).success).toBe(true);
  });
  it("rejeita enunciado vazio", () => {
    expect(perguntaSchema.safeParse({ tipo: "texto", enunciado: "" }).success).toBe(false);
  });
});

describe("respostaValorSchema", () => {
  it("valida nota de escala", () => {
    expect(respostaValorSchema("escala").safeParse({ nota: 3 }).success).toBe(true);
    expect(respostaValorSchema("escala").safeParse({ nota: "x" }).success).toBe(false);
  });
  it("valida texto", () => {
    expect(respostaValorSchema("texto").safeParse({ texto: "oi" }).success).toBe(true);
    expect(respostaValorSchema("texto").safeParse({ texto: "" }).success).toBe(false);
  });
  it("valida sim/não", () => {
    expect(respostaValorSchema("sim_nao").safeParse({ sim_nao: true }).success).toBe(true);
  });
  it("valida múltipla escolha", () => {
    expect(respostaValorSchema("multipla_escolha").safeParse({ escolha: "A" }).success).toBe(true);
    expect(respostaValorSchema("multipla_escolha").safeParse({ escolha: "" }).success).toBe(false);
  });
});
