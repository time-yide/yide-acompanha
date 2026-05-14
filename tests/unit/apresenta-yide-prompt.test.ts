import { describe, it, expect } from "vitest";
import { buildApresentacaoPrompt, APRESENTACAO_SYSTEM } from "@/lib/apresenta-yide/prompt";

describe("APRESENTACAO_SYSTEM", () => {
  it("menciona os 6 templates por nome", () => {
    expect(APRESENTACAO_SYSTEM).toContain("capa");
    expect(APRESENTACAO_SYSTEM).toContain("conteudo");
    expect(APRESENTACAO_SYSTEM).toContain("duas_colunas");
    expect(APRESENTACAO_SYSTEM).toContain("metrica");
    expect(APRESENTACAO_SYSTEM).toContain("topicos_numerados");
    expect(APRESENTACAO_SYSTEM).toContain("encerramento");
  });

  it("instrui a saída line-delimited JSON", () => {
    expect(APRESENTACAO_SYSTEM).toMatch(/uma linha por slide/i);
  });

  it("força pt-BR", () => {
    expect(APRESENTACAO_SYSTEM).toMatch(/pt-?br/i);
  });
});

describe("buildApresentacaoPrompt", () => {
  it("inclui prompt do usuário, objetivo e número de slides", () => {
    const out = buildApresentacaoPrompt({
      prompt: "Apresentar resultados de tráfego",
      objetivo: "fechar venda com cliente novo",
      numSlides: 10,
    });
    expect(out).toContain("Apresentar resultados de tráfego");
    expect(out).toContain("fechar venda com cliente novo");
    expect(out).toContain("10");
  });

  it("omite objetivo quando é null", () => {
    const out = buildApresentacaoPrompt({
      prompt: "Pitch deck",
      objetivo: null,
      numSlides: 6,
    });
    expect(out).toContain("Pitch deck");
    expect(out).not.toMatch(/Objetivo/);
  });
});
