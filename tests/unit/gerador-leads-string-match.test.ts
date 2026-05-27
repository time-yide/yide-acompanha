import { describe, it, expect } from "vitest";
import { normalizeName, similarity } from "@/lib/gerador-leads/utils/string-match";

describe("normalizeName", () => {
  it("remove acentos e baixa case", () => {
    expect(normalizeName("João Da Silva")).toBe("joao da silva");
  });
  it("remove espaços extras", () => {
    expect(normalizeName("  JOÃO   DA  SILVA  ")).toBe("joao da silva");
  });
  it("retorna string vazia pra null", () => {
    expect(normalizeName(null)).toBe("");
  });
});

describe("similarity", () => {
  it("nomes iguais retornam 1.0", () => {
    expect(similarity("João Silva", "João Silva")).toBeCloseTo(1.0);
  });
  it("nomes parecidos retornam alto (>0.8)", () => {
    expect(similarity("João da Silva", "Joao Silva")).toBeGreaterThan(0.8);
  });
  it("nomes diferentes retornam baixo (<0.5)", () => {
    expect(similarity("João Silva", "Pedro Souza")).toBeLessThan(0.5);
  });
  it("um nome null retorna 0", () => {
    expect(similarity(null, "João Silva")).toBe(0);
  });
  it("nome com sobrenome a mais ainda casa bem", () => {
    expect(similarity("João Silva", "João da Silva Santos")).toBeGreaterThan(0.7);
  });
});
