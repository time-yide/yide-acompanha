import { describe, it, expect } from "vitest";
import { SEED_SERVICOS, SEED_LOCALIDADES } from "@/lib/seo/config";

describe("seed de SEO", () => {
  it("tem os 9 serviços com slugs únicos, mantendo os 5 antigos", () => {
    const slugs = SEED_SERVICOS.map((s) => s.slug);
    expect(slugs).toEqual([
      "gestao-de-trafego", "crm-ia-dados", "audiovisual", "redes-sociais", "criacao-de-sites",
      "ecommerce", "marketplaces", "assessoria-de-marketing", "seo-google",
    ]);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
  it("ordem segue a lista", () => {
    expect(SEED_SERVICOS.map((s) => s.ordem)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  it("inclui as cidades de MT do nível 2", () => {
    const slugs = SEED_LOCALIDADES.map((l) => l.slug);
    for (const s of ["rondonopolis", "sinop", "sorriso", "tangara-da-serra", "lucas-do-rio-verde", "primavera-do-leste"]) {
      expect(slugs).toContain(s);
    }
  });
});
