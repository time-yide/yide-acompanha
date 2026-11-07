import { describe, it, expect } from "vitest";
import { jsonLdOrganizacao } from "@/lib/seo/schema";
import { montarLlmsTxt } from "@/lib/seo/llms";
import { YIDE_NAP } from "@/lib/seo/config";

describe("jsonLdOrganizacao", () => {
  it("traz nome, endereço completo, telefone e perfis", () => {
    const ld = jsonLdOrganizacao();
    expect(ld.name).toBe("Yide Digital");
    expect(ld.telephone).toBe("+55 65 99306-3452");
    expect(ld.address.streetAddress).toBe("R. Martinica, 280 - Jardim das Américas");
    expect(ld.address.addressLocality).toBe("Cuiabá");
    expect(ld.address.postalCode).toBe("78060-644");
    expect(ld.sameAs).toContain("https://www.instagram.com/yide.digital/");
    expect(ld.sameAs).toContain("https://maps.google.com/?cid=14243144777750195365");
    expect(ld.knowsAbout.length).toBeGreaterThan(0);
  });
  it("atende 24h, todos os dias", () => {
    const ld = jsonLdOrganizacao();
    expect(ld.openingHoursSpecification.opens).toBe("00:00");
    expect(ld.openingHoursSpecification.closes).toBe("23:59");
    expect(ld.openingHoursSpecification.dayOfWeek).toHaveLength(7);
  });
  it("área atendida: Cuiabá, Várzea Grande, Mato Grosso e Brasil", () => {
    const nomes = jsonLdOrganizacao().areaServed.map((a: { name: string }) => a.name);
    expect(nomes).toEqual(["Cuiabá", "Várzea Grande", "Mato Grosso", "Brasil"]);
  });
});

describe("montarLlmsTxt", () => {
  const txt = montarLlmsTxt({
    siteUrl: "https://blog.exemplo.com.br",
    servicos: [{ nome: "Tráfego", slug: "trafego", descricao_base: "Anúncios" }],
    posts: [{ titulo: "Post", slug: "post", resumo: null }],
    cases: [{ cliente: "Kai Poke", segmento: "Restaurante", slug: "kai" }],
  });
  it("lista empresa, serviços e artigos com links completos", () => {
    expect(txt).toContain(`# ${YIDE_NAP.nome}`);
    expect(txt).toContain("- [Tráfego](https://blog.exemplo.com.br/servicos/trafego): Anúncios");
    expect(txt).toContain("- [Post](https://blog.exemplo.com.br/blog/post)\n");
  });
  it("traz endereço, horário, áreas atendidas e cases", () => {
    expect(txt).toContain("Endereço: R. Martinica, 280 - Jardim das Américas, Cuiabá - MT, 78060-644");
    expect(txt).toContain("WhatsApp: +55 65 99306-3452");
    expect(txt).toContain("Atendimento: 24 horas, todos os dias");
    expect(txt).toContain("Atende: Cuiabá, Várzea Grande, Mato Grosso e todo o Brasil");
    expect(txt).toContain("- [Kai Poke (Restaurante)](https://blog.exemplo.com.br/cases/kai)");
  });
});
