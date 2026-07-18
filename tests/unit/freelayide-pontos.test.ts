// tests/unit/freelayide-pontos.test.ts
import { describe, it, expect } from "vitest";
import { calcularPontos, transicaoValida, bonusPegar, bonusFechamento } from "@/lib/freela-yide/pontos";

describe("calcularPontos", () => {
  it("disponível = 0", () => {
    expect(calcularPontos({ status: "disponivel", negociacao_em: null, fechada_em: null, valor_comissao: 600 })).toBe(0);
  });
  it("pega de R$600 = bônus de pegar 10", () => {
    expect(calcularPontos({ status: "pega", negociacao_em: null, fechada_em: null, valor_comissao: 600 })).toBe(10);
  });
  it("em negociação de R$600 = 10 (pegar) + 10 (nego) => 20", () => {
    expect(calcularPontos({ status: "em_negociacao", negociacao_em: "2026-05-01", fechada_em: null, valor_comissao: 600 })).toBe(20);
  });
  it("fechada de R$600 com negociação = 10 + 10 + 35 => 55", () => {
    expect(calcularPontos({ status: "fechada", negociacao_em: "2026-05-01", fechada_em: "2026-05-02", valor_comissao: 600 })).toBe(55);
  });
  it("fechada de R$600 sem negociação = 10 + 35 => 45", () => {
    expect(calcularPontos({ status: "fechada", negociacao_em: null, fechada_em: "2026-05-02", valor_comissao: 600 })).toBe(45);
  });
  it("freela pequena (R$100) fechada c/ nego: 20 (pegar) + 10 + 80 => 110", () => {
    expect(calcularPontos({ status: "fechada", negociacao_em: "2026-05-01", fechada_em: "2026-05-02", valor_comissao: 100 })).toBe(110);
  });
  it("freela gorda (R$1500) fechada c/ nego: 5 (pegar) + 10 + 10 => 25", () => {
    expect(calcularPontos({ status: "fechada", negociacao_em: "2026-05-01", fechada_em: "2026-05-02", valor_comissao: 1500 })).toBe(25);
  });
  it("pegar pequena rende mais que pegar gorda", () => {
    const pequena = calcularPontos({ status: "pega", negociacao_em: null, fechada_em: null, valor_comissao: 80 });
    const gorda = calcularPontos({ status: "pega", negociacao_em: null, fechada_em: null, valor_comissao: 1200 });
    expect(pequena).toBe(20);
    expect(gorda).toBe(5);
    expect(pequena).toBeGreaterThan(gorda);
  });
  it("perdida de R$600 = 10 (pegou) sem bônus de fechar", () => {
    expect(calcularPontos({ status: "perdida", negociacao_em: null, fechada_em: null, valor_comissao: 600 })).toBe(10);
  });
});

describe("bonusPegar (inverso ao valor, por faixa)", () => {
  it("≤ R$100 => 20", () => {
    expect(bonusPegar(0)).toBe(20);
    expect(bonusPegar(100)).toBe(20);
  });
  it("R$101–300 => 15", () => {
    expect(bonusPegar(101)).toBe(15);
    expect(bonusPegar(300)).toBe(15);
  });
  it("R$301–600 => 10", () => {
    expect(bonusPegar(301)).toBe(10);
    expect(bonusPegar(600)).toBe(10);
  });
  it("R$601–1000 => 7", () => {
    expect(bonusPegar(601)).toBe(7);
    expect(bonusPegar(1000)).toBe(7);
  });
  it("> R$1000 => 5", () => {
    expect(bonusPegar(1001)).toBe(5);
    expect(bonusPegar(99999)).toBe(5);
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
