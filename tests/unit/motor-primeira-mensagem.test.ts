// tests/unit/motor-primeira-mensagem.test.ts
import { describe, it, expect } from "vitest";
import {
  SAUDACOES_CASUAIS,
  ehPrimeiraMensagem,
  montarPrimeiraMensagemCasual,
  perfilPublico,
} from "@/lib/motor-prospeccao/primeira-mensagem";

describe("montarPrimeiraMensagemCasual", () => {
  it("retorna sempre uma saudação casual curta, sem pitch", () => {
    for (const seed of ["a", "lead-1", "550e8400-e29b-41d4-a716-446655440000", ""]) {
      const msg = montarPrimeiraMensagemCasual(seed);
      expect(SAUDACOES_CASUAIS).toContain(msg);
      expect(msg.toLowerCase()).toMatch(/tudo b(em|om)/);
      expect(msg.toLowerCase()).not.toContain("yide");
      expect(msg.split("\n")).toHaveLength(1);
    }
  });

  it("é determinística para o mesmo lead", () => {
    expect(montarPrimeiraMensagemCasual("lead-xyz")).toBe(montarPrimeiraMensagemCasual("lead-xyz"));
  });

  it("varia entre leads diferentes", () => {
    const usadas = new Set(Array.from({ length: 50 }, (_, i) => montarPrimeiraMensagemCasual(`lead-${i}`)));
    expect(usadas.size).toBeGreaterThan(1);
  });
});

describe("ehPrimeiraMensagem", () => {
  it("primeiro_contato sempre é primeira mensagem", () => {
    expect(ehPrimeiraMensagem("primeiro_contato", 0)).toBe(true);
    expect(ehPrimeiraMensagem("primeiro_contato", 2)).toBe(true);
  });

  it("auto só na primeira tentativa", () => {
    expect(ehPrimeiraMensagem("auto", 0)).toBe(true);
    expect(ehPrimeiraMensagem("auto", 1)).toBe(false);
  });

  it("followup e ultimo nunca", () => {
    expect(ehPrimeiraMensagem("followup", 0)).toBe(false);
    expect(ehPrimeiraMensagem("ultimo", 0)).toBe(false);
  });
});

describe("perfilPublico", () => {
  it("indústria/fábrica/distribuidora é B2B", () => {
    expect(perfilPublico("Indústria de alimentos")).toBe("b2b");
    expect(perfilPublico("Fábrica de móveis")).toBe("b2b");
    expect(perfilPublico("Distribuidora de bebidas")).toBe("b2b");
  });

  it("comércio/serviço local ou sem categoria é B2C", () => {
    expect(perfilPublico("Restaurante")).toBe("b2c");
    expect(perfilPublico("Salão de beleza")).toBe("b2c");
    expect(perfilPublico(null)).toBe("b2c");
  });
});
