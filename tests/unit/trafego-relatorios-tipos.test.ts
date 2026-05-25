import { describe, it, expect } from "vitest";
import { isValidSlide, isValidSlides } from "@/lib/trafego/relatorios/tipos";

describe("isValidSlide", () => {
  it("aceita slide capa válido", () => {
    expect(isValidSlide({ template: "capa", content: { template: "capa", titulo: "X" } })).toBe(true);
  });

  it("rejeita capa sem titulo", () => {
    expect(isValidSlide({ template: "capa", content: { template: "capa" } })).toBe(false);
  });

  it("aceita grafico_barras com 1-7 itens", () => {
    const slide = {
      template: "grafico_barras",
      content: {
        template: "grafico_barras",
        titulo: "Top campanhas",
        unidade: "moeda",
        dados: [{ label: "C1", valor: 100 }, { label: "C2", valor: 50 }],
      },
    };
    expect(isValidSlide(slide)).toBe(true);
  });

  it("rejeita grafico_barras com 8 itens", () => {
    const slide = {
      template: "grafico_barras",
      content: {
        template: "grafico_barras",
        titulo: "X",
        unidade: "numero",
        dados: Array.from({ length: 8 }, (_, i) => ({ label: `c${i}`, valor: i })),
      },
    };
    expect(isValidSlide(slide)).toBe(false);
  });

  it("rejeita grafico_barras com unidade inválida", () => {
    const slide = {
      template: "grafico_barras",
      content: { template: "grafico_barras", titulo: "X", unidade: "kg", dados: [{ label: "a", valor: 1 }] },
    };
    expect(isValidSlide(slide)).toBe(false);
  });

  it("rejeita slide com template desconhecido", () => {
    expect(isValidSlide({ template: "foobar", content: { template: "foobar" } })).toBe(false);
  });
});

describe("isValidSlides", () => {
  it("aceita array vazio", () => {
    expect(isValidSlides([])).toBe(true);
  });
  it("rejeita não-array", () => {
    expect(isValidSlides("xyz")).toBe(false);
  });
});
