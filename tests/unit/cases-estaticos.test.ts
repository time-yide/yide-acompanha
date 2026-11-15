import { describe, it, expect } from "vitest";
import { CASES_ESTATICOS, caseEstaticoPorSlug } from "@/lib/site/cases-estaticos";

describe("cases escritos no código", () => {
  it("slugs únicos e conteúdo completo", () => {
    const slugs = CASES_ESTATICOS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const c of CASES_ESTATICOS) {
      expect(c.conteudo_md.length).toBeGreaterThan(300);
      expect(c.resultados.length).toBe(3);
      expect(c.meta_title).toBeTruthy();
    }
  });
  it("acha pelo slug", () => {
    expect(caseEstaticoPorSlug("nazca-sushi-delivery")?.cliente).toBe("Nazca Sushi");
    expect(caseEstaticoPorSlug("nao-existe")).toBeNull();
  });
});
