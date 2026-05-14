import { describe, it, expect } from "vitest";
import { isValidSlide, isValidApresentacaoSlides } from "@/lib/apresenta-yide/tipos";

describe("isValidSlide", () => {
  it("aceita capa válida", () => {
    expect(isValidSlide({
      template: "capa",
      content: { template: "capa", titulo: "Yide" },
    })).toBe(true);
  });

  it("aceita capa com subtítulo opcional", () => {
    expect(isValidSlide({
      template: "capa",
      content: { template: "capa", titulo: "Yide", subtitulo: "Agência" },
    })).toBe(true);
  });

  it("rejeita capa sem titulo", () => {
    expect(isValidSlide({
      template: "capa",
      content: { template: "capa" },
    })).toBe(false);
  });

  it("aceita conteudo com bullets", () => {
    expect(isValidSlide({
      template: "conteudo",
      content: { template: "conteudo", titulo: "X", bullets: ["a", "b"] },
    })).toBe(true);
  });

  it("aceita duas_colunas válida", () => {
    expect(isValidSlide({
      template: "duas_colunas",
      content: {
        template: "duas_colunas",
        titulo: "Antes vs Depois",
        coluna_esquerda: { titulo: "Antes", texto: "ruim" },
        coluna_direita: { titulo: "Depois", texto: "bom" },
      },
    })).toBe(true);
  });

  it("aceita metrica", () => {
    expect(isValidSlide({
      template: "metrica",
      content: { template: "metrica", numero: "R$ 50k", label: "Faturamento" },
    })).toBe(true);
  });

  it("aceita topicos_numerados", () => {
    expect(isValidSlide({
      template: "topicos_numerados",
      content: {
        template: "topicos_numerados",
        titulo: "5 passos",
        topicos: [{ titulo: "Passo 1" }, { titulo: "Passo 2" }],
      },
    })).toBe(true);
  });

  it("aceita encerramento", () => {
    expect(isValidSlide({
      template: "encerramento",
      content: { template: "encerramento", mensagem: "Obrigado!" },
    })).toBe(true);
  });

  it("rejeita template inválido", () => {
    expect(isValidSlide({
      template: "inexistente",
      content: { template: "inexistente" },
    })).toBe(false);
  });

  it("rejeita quando content.template não bate com template do wrapper", () => {
    expect(isValidSlide({
      template: "capa",
      content: { template: "conteudo", titulo: "X" },
    })).toBe(false);
  });
});

describe("isValidApresentacaoSlides", () => {
  it("aceita array vazio", () => {
    expect(isValidApresentacaoSlides([])).toBe(true);
  });

  it("aceita array de slides válidos", () => {
    expect(isValidApresentacaoSlides([
      { template: "capa", content: { template: "capa", titulo: "Y" } },
      { template: "encerramento", content: { template: "encerramento", mensagem: "Fim" } },
    ])).toBe(true);
  });

  it("rejeita array com algum slide inválido", () => {
    expect(isValidApresentacaoSlides([
      { template: "capa", content: { template: "capa", titulo: "Y" } },
      { foo: "bar" },
    ])).toBe(false);
  });

  it("rejeita não-array", () => {
    expect(isValidApresentacaoSlides("string")).toBe(false);
    expect(isValidApresentacaoSlides(null)).toBe(false);
    expect(isValidApresentacaoSlides({})).toBe(false);
  });
});
