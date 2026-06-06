// tests/unit/design-studio-prompt.test.ts
import { describe, it, expect } from "vitest";
import { buildStudioSystemPrompt } from "@/lib/design/studio-prompt";
import type { ManualMarca, Composicao } from "@/lib/design/studio-tipos";

const manual: ManualMarca = {
  fontes: [
    { nome: "Marca Sans", papel: "titulo", url: "u1", format: "opentype" },
    { nome: "Marca Text", papel: "corpo", url: "u2", format: "truetype" },
  ],
  logo_url: "logo.png",
  fundo_padrao: "#062e10",
  paletas: ["#009c3b", "#ffdf00"],
  mood: "Esportivo, vibrante",
  tom_voz: "Direto e empolgado",
  evitar: "Nada de marrom",
};

const comp: Composicao = {
  formato: "feed",
  fundo: { cor: "#062e10", foto: null, listras: true },
  camadas: [],
};

describe("buildStudioSystemPrompt", () => {
  const out = buildStudioSystemPrompt(manual, comp);

  it("inclui as fontes da marca com papel", () => {
    expect(out).toContain("Marca Sans");
    expect(out).toContain("Marca Text");
  });
  it("inclui a paleta em hex", () => {
    expect(out).toContain("#009c3b");
    expect(out).toContain("#ffdf00");
  });
  it("inclui tom de voz e regras de evitar", () => {
    expect(out).toContain("Direto e empolgado");
    expect(out).toContain("Nada de marrom");
  });
  it("instrui a seguir a marca por padrão e só desviar se pedido", () => {
    expect(out).toMatch(/por padr[ãa]o/i);
    expect(out).toMatch(/s[óo].*(pedir|solicitar|pedido)/i);
  });
  it("documenta o contrato de saída com o marcador ---JSON---", () => {
    expect(out).toContain("---JSON---");
    expect(out).toContain("commands");
  });
  it("inclui as dimensões reais do formato atual", () => {
    expect(out).toContain("1080");
  });
  it("informa o número de camadas atuais da canvas", () => {
    const comComCamadas = buildStudioSystemPrompt(manual, {
      ...comp,
      camadas: [{ id: "a", tipo: "texto", text: "X", x: 0, y: 0, w: 10,
        fontSize: 10, fontWeight: 400, color: "#fff", align: "left",
        font: "Marca Sans", spacing: 0, opacity: 1, z: 1 }],
    });
    expect(comComCamadas).toMatch(/1 (elemento|camada)/i);
  });
});
