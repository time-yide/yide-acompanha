// tests/unit/freelayide-pontos.test.ts
import { describe, it, expect } from "vitest";
import { calcularPontos, transicaoValida, bonusFechamento } from "@/lib/freela-yide/pontos";

describe("calcularPontos", () => {
  it("disponível = 0", () => {
    expect(calcularPontos({ status: "disponivel", negociacao_em: null, fechada_em: null, valor_comissao: 600 })).toBe(0);
  });
  it("pega = 5", () => {
    expect(calcularPontos({ status: "pega", negociacao_em: null, fechada_em: null, valor_comissao: 600 })).toBe(5);
  });
  it("em negociação = 5 + 10", () => {
    expect(calcularPontos({ status: "em_negociacao", negociacao_em: "2026-05-01", fechada_em: null, valor_comissao: 600 })).toBe(15);
  });
  it("fechada de R$600 com negociação = 5 + 10 + 35 => 50", () => {
    expect(calcularPontos({ status: "fechada", negociacao_em: "2026-05-01", fechada_em: "2026-05-02", valor_comissao: 600 })).toBe(50);
  });
  it("fechada de R$600 sem negociação = 5 + 35 => 40", () => {
    expect(calcularPontos({ status: "fechada", negociacao_em: null, fechada_em: "2026-05-02", valor_comissao: 600 })).toBe(40);
  });
  it("freela pequena (R$100) fechada c/ nego rende mais que a gorda: 5 + 10 + 80 => 95", () => {
    expect(calcularPontos({ status: "fechada", negociacao_em: "2026-05-01", fechada_em: "2026-05-02", valor_comissao: 100 })).toBe(95);
  });
  it("freela gorda (R$1500) fechada c/ nego rende pouco: 5 + 10 + 10 => 25", () => {
    expect(calcularPontos({ status: "fechada", negociacao_em: "2026-05-01", fechada_em: "2026-05-02", valor_comissao: 1500 })).toBe(25);
  });
  it("perdida = 5 (pegou) sem bônus de fechar", () => {
    expect(calcularPontos({ status: "perdida", negociacao_em: null, fechada_em: null, valor_comissao: 600 })).toBe(5);
  });
});

describe("bonusFechamento (inverso ao valor, por faixa)", () => {
  it("≤ R$100 => 80", () => {
    expect(bonusFechamento(0)).toBe(80);
    expect(bonusFechamento(100)).toBe(80);
  });
  it("R$101–300 => 55", () => {
    expect(bonusFechamento(101)).toBe(55);
    expect(bonusFechamento(300)).toBe(55);
  });
  it("R$301–600 => 35", () => {
    expect(bonusFechamento(301)).toBe(35);
    expect(bonusFechamento(600)).toBe(35);
  });
  it("R$601–1000 => 20", () => {
    expect(bonusFechamento(601)).toBe(20);
    expect(bonusFechamento(1000)).toBe(20);
  });
  it("> R$1000 => 10", () => {
    expect(bonusFechamento(1001)).toBe(10);
    expect(bonusFechamento(99999)).toBe(10);
  });
});

describe("transicaoValida", () => {
  it("disponivel -> pega ok", () => expect(transicaoValida("disponivel", "pega")).toBe(true));
  it("pega -> fechada ok", () => expect(transicaoValida("pega", "fechada")).toBe(true));
  it("disponivel -> fechada inválido", () => expect(transicaoValida("disponivel", "fechada")).toBe(false));
  it("fechada -> qualquer inválido", () => expect(transicaoValida("fechada", "pega")).toBe(false));
});
