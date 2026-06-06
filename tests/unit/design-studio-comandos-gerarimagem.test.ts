// tests/unit/design-studio-comandos-gerarimagem.test.ts
import { describe, it, expect } from "vitest";
import { parseRespostaIA, ACOES_VALIDAS } from "@/lib/design/studio-comandos";

describe("gerarImagem command", () => {
  it("gerarImagem está na whitelist", () => {
    expect(ACOES_VALIDAS).toContain("gerarImagem");
  });

  it("aceita gerarImagem com prompt e alvo", () => {
    const raw = `ok\n---JSON---\n{"commands":[{"action":"gerarImagem","prompt":"a premium bbq background","alvo":"fundo"}]}`;
    const out = parseRespostaIA(raw);
    expect(out.comandos).toEqual([
      { action: "gerarImagem", prompt: "a premium bbq background", alvo: "fundo" },
    ]);
  });

  it("alvo default é 'fundo' quando ausente", () => {
    const raw = `ok\n---JSON---\n{"commands":[{"action":"gerarImagem","prompt":"x"}]}`;
    const out = parseRespostaIA(raw);
    expect(out.comandos[0]).toEqual({ action: "gerarImagem", prompt: "x", alvo: "fundo" });
  });

  it("descarta gerarImagem sem prompt", () => {
    const raw = `ok\n---JSON---\n{"commands":[{"action":"gerarImagem","alvo":"fundo"}]}`;
    expect(parseRespostaIA(raw).comandos).toEqual([]);
  });

  it("alvo inválido cai pra 'fundo'", () => {
    const raw = `ok\n---JSON---\n{"commands":[{"action":"gerarImagem","prompt":"x","alvo":"banner"}]}`;
    expect(parseRespostaIA(raw).comandos[0]).toEqual({ action: "gerarImagem", prompt: "x", alvo: "fundo" });
  });
});
