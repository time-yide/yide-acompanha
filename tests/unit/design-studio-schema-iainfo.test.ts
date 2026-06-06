// tests/unit/design-studio-schema-iainfo.test.ts
import { describe, it, expect } from "vitest";
import { salvarComposicaoSchema } from "@/lib/design/studio-schema";

const base = {
  clientId: "11111111-1111-1111-1111-111111111111",
  arteId: null,
  titulo: "Arte IA",
  formato: "feed",
  composicao: { formato: "feed", fundo: { cor: "#000", foto: null, listras: false }, camadas: [] },
  pngBase64: "data:image/png;base64,iVBOR",
};

describe("salvarComposicaoSchema — iaInfo opcional", () => {
  it("aceita sem iaInfo", () => {
    expect(salvarComposicaoSchema.safeParse(base).success).toBe(true);
  });
  it("aceita com iaInfo válido", () => {
    const r = salvarComposicaoSchema.safeParse({
      ...base, iaInfo: { modelo: "gpt-image-1", prompt: "a bbq background" },
    });
    expect(r.success).toBe(true);
  });
  it("rejeita iaInfo sem prompt", () => {
    const r = salvarComposicaoSchema.safeParse({ ...base, iaInfo: { modelo: "gpt-image-1" } });
    expect(r.success).toBe(false);
  });
});
