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

import { jsonLdServicoNacional } from "@/lib/seo/schema";

describe("jsonLdServicoNacional", () => {
  const g = jsonLdServicoNacional({
    nome: "Gestão de Tráfego Pago", descricao: "Anúncios que vendem", url: "https://yidedigital.com.br/servicos/gestao-de-trafego",
    faq: [{ pergunta: "Quanto custa?", resposta: "Depende." }],
  });
  const tipos = g["@graph"].map((n: { "@type": string }) => n["@type"]);
  it("tem Service, FAQPage e BreadcrumbList", () => {
    expect(tipos).toEqual(expect.arrayContaining(["Service", "FAQPage", "BreadcrumbList"]));
  });
  it("serviço aponta para a organização e atende Brasil e Cuiabá", () => {
    const s = g["@graph"].find((n: { "@type": string }) => n["@type"] === "Service");
    expect(s.provider["@id"]).toBe("https://yidedigital.com.br/#organizacao");
    expect(s.areaServed.map((a: { name: string }) => a.name)).toEqual(["Cuiabá", "Várzea Grande", "Mato Grosso", "Brasil"]);
  });
  it("breadcrumb: Início > Serviços > serviço", () => {
    const b = g["@graph"].find((n: { "@type": string }) => n["@type"] === "BreadcrumbList");
    expect(b.itemListElement.map((i: { name: string }) => i.name)).toEqual(["Início", "Serviços", "Gestão de Tráfego Pago"]);
  });
});
