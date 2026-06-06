// tests/unit/design-studio-prompt-geracao.test.ts
import { describe, it, expect } from "vitest";
import { buildStudioSystemPrompt } from "@/lib/design/studio-prompt";
import type { ManualMarca, Composicao } from "@/lib/design/studio-tipos";

const manual: ManualMarca = {
  fontes: [], logo_url: null, fundo_padrao: "#111", paletas: ["#009c3b"],
  mood: "", tom_voz: "", evitar: "",
};
const comp: Composicao = {
  formato: "feed", fundo: { cor: "#111", foto: null, listras: false }, camadas: [],
};

describe("prompt — regra de geração de imagem", () => {
  const out = buildStudioSystemPrompt(manual, comp);
  it("documenta o comando gerarImagem", () => {
    expect(out).toContain("gerarImagem");
  });
  it("instrui a preferir foto real e só gerar sob demanda", () => {
    expect(out).toMatch(/foto.*real/i);
    expect(out).toMatch(/(explicit|pedir|pedid|confirm)/i);
  });
  it("instrui a sugerir sem gerar sem confirmação", () => {
    expect(out).toMatch(/sugeri|sugest/i);
  });
  it("instrui prompt em inglês", () => {
    expect(out).toMatch(/ingl[eê]s/i);
  });
});
