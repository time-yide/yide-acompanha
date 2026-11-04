import { describe, it, expect } from "vitest";
import { jsonLdOrganizacao } from "@/lib/seo/schema";
import { montarLlmsTxt } from "@/lib/seo/llms";
import { YIDE_NAP } from "@/lib/seo/config";

describe("jsonLdOrganizacao", () => {
  it("traz nome, cidade, telefone e perfis", () => {
    const ld = jsonLdOrganizacao();
    expect(ld.name).toBe("Yide Digital");
    expect(ld.telephone).toBe("+55 65 9306-3452");
    expect(ld.address.addressLocality).toBe("Cuiabá");
    expect(ld.sameAs).toContain("https://www.instagram.com/yide.digital/");
    expect(ld.knowsAbout.length).toBeGreaterThan(0);
  });
});

describe("montarLlmsTxt", () => {
  const txt = montarLlmsTxt({
    siteUrl: "https://blog.exemplo.com.br",
    servicos: [{ nome: "Tráfego", slug: "trafego", descricao_base: "Anúncios" }],
    posts: [{ titulo: "Post", slug: "post", resumo: null }],
  });
  it("lista empresa, serviços e artigos com links completos", () => {
    expect(txt).toContain(`# ${YIDE_NAP.nome}`);
    expect(txt).toContain("- [Tráfego](https://blog.exemplo.com.br/servicos/trafego): Anúncios");
    expect(txt).toContain("- [Post](https://blog.exemplo.com.br/blog/post)\n");
  });
});
