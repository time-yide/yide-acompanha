import { describe, it, expect } from "vitest";
import { jsonLdServicoLocal } from "@/lib/seo/schema";

const base = { servicoNome: "Gestão de Tráfego Pago", descricao: "Anúncios que vendem",
  url: "https://yidedigital.com.br/servicos/gestao-de-trafego/salvador",
  faq: [{ pergunta: "Quanto custa?", resposta: "Depende do projeto." }] };

describe("jsonLdServicoLocal", () => {
  it("cidade vira areaServed City", () => {
    const g = jsonLdServicoLocal({ ...base, localidadeNome: "Salvador", tipo: "cidade", uf: "BA" });
    const s = g["@graph"].find((n: { "@type": string }) => n["@type"] === "Service");
    expect(s.areaServed["@type"]).toBe("City");
    expect(s.areaServed.name).toBe("Salvador");
  });
  it("estado vira AdministrativeArea", () => {
    const g = jsonLdServicoLocal({ ...base, localidadeNome: "Bahia", tipo: "estado", uf: "BA" });
    const s = g["@graph"].find((n: { "@type": string }) => n["@type"] === "Service");
    expect(s.areaServed["@type"]).toBe("AdministrativeArea");
  });
  it("inclui FAQPage quando há faq", () => {
    const g = jsonLdServicoLocal({ ...base, localidadeNome: "Salvador", tipo: "cidade", uf: "BA" });
    expect(g["@graph"].some((n: { "@type": string }) => n["@type"] === "FAQPage")).toBe(true);
  });
  it("sem faq não inclui FAQPage", () => {
    const g = jsonLdServicoLocal({ ...base, faq: [], localidadeNome: "Salvador", tipo: "cidade", uf: "BA" });
    expect(g["@graph"].some((n: { "@type": string }) => n["@type"] === "FAQPage")).toBe(false);
  });
});
