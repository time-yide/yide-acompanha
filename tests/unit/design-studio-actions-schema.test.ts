// tests/unit/design-studio-actions-schema.test.ts
import { describe, it, expect } from "vitest";
import { salvarComposicaoSchema } from "@/lib/design/studio-actions";

describe("salvarComposicaoSchema", () => {
  it("aceita payload válido com composição e pngBase64", () => {
    const r = salvarComposicaoSchema.safeParse({
      clientId: "11111111-1111-1111-1111-111111111111",
      arteId: null,
      titulo: "Post jogo",
      formato: "feed",
      composicao: { formato: "feed", fundo: { cor: "#000", foto: null, listras: false }, camadas: [] },
      pngBase64: "data:image/png;base64,iVBOR",
    });
    expect(r.success).toBe(true);
  });
  it("rejeita titulo vazio", () => {
    const r = salvarComposicaoSchema.safeParse({
      clientId: "11111111-1111-1111-1111-111111111111",
      arteId: null, titulo: "", formato: "feed",
      composicao: { formato: "feed", fundo: { cor: "#000", foto: null, listras: false }, camadas: [] },
      pngBase64: "data:image/png;base64,iVBOR",
    });
    expect(r.success).toBe(false);
  });
  it("rejeita pngBase64 que não é data:image/png", () => {
    const r = salvarComposicaoSchema.safeParse({
      clientId: "11111111-1111-1111-1111-111111111111",
      arteId: null, titulo: "X", formato: "feed",
      composicao: { formato: "feed", fundo: { cor: "#000", foto: null, listras: false }, camadas: [] },
      pngBase64: "not-a-data-url",
    });
    expect(r.success).toBe(false);
  });
});
