// tests/unit/freelayide-pontos.test.ts
import { describe, it, expect } from "vitest";
import { calcularPontos, transicaoValida } from "@/lib/freela-yide/pontos";

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
  it("fechada com negociação = 5 + 10 + 50 + floor(600/50)=12 => 77", () => {
    expect(calcularPontos({ status: "fechada", negociacao_em: "2026-05-01", fechada_em: "2026-05-02", valor_comissao: 600 })).toBe(77);
  });
  it("fechada sem ter passado por negociação = 5 + 50 + 12 => 67", () => {
    expect(calcularPontos({ status: "fechada", negociacao_em: null, fechada_em: "2026-05-02", valor_comissao: 600 })).toBe(67);
  });
  it("perdida = 5 (pegou) sem bônus de fechar", () => {
    expect(calcularPontos({ status: "perdida", negociacao_em: null, fechada_em: null, valor_comissao: 600 })).toBe(5);
  });
});

describe("transicaoValida", () => {
  it("disponivel -> pega ok", () => expect(transicaoValida("disponivel", "pega")).toBe(true));
  it("pega -> fechada ok", () => expect(transicaoValida("pega", "fechada")).toBe(true));
  it("disponivel -> fechada inválido", () => expect(transicaoValida("disponivel", "fechada")).toBe(false));
  it("fechada -> qualquer inválido", () => expect(transicaoValida("fechada", "pega")).toBe(false));
});
