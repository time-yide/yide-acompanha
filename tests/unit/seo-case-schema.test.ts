import { describe, it, expect } from "vitest";
import { jsonLdCase } from "@/lib/seo/case-schema";
const base = { titulo: "Case Kumon", descricao: "Resultados", url: "https://yidedigital.com.br/cases/kumon" };
describe("jsonLdCase", () => {
  it("tem Article", () => {
    const g = jsonLdCase({ ...base, depoimentoTexto: "", depoimentoAutor: "" });
    expect(g["@graph"].some((n: { "@type": string }) => n["@type"] === "Article")).toBe(true);
  });
  it("inclui Review quando há depoimento", () => {
    const g = jsonLdCase({ ...base, depoimentoTexto: "Ótimo", depoimentoAutor: "João" });
    const r = g["@graph"].find((n: { "@type": string }) => n["@type"] === "Review");
    expect(r).toBeTruthy();
    expect(r.reviewBody).toBe("Ótimo");
    expect(r.author.name).toBe("João");
  });
  it("sem depoimento não inclui Review", () => {
    const g = jsonLdCase({ ...base, depoimentoTexto: "", depoimentoAutor: "" });
    expect(g["@graph"].some((n: { "@type": string }) => n["@type"] === "Review")).toBe(false);
  });
});
