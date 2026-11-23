import { describe, expect, it } from "vitest";
import {
  dominioDoSite, dominioRegistravel, GA4_PENDENTE, measurementIdValido, mensagemVerificacaoDns, nomeRegistroTxt,
  normalizarSiteUrl, plataformaDoSite, snippetGa4,
} from "./site";

describe("dados/site", () => {
  it("normaliza pra origem", () => {
    expect(normalizarSiteUrl("https://www.Exemplo.com.br/contato?x=1")).toBe("https://www.exemplo.com.br");
    expect(normalizarSiteUrl("exemplo.com.br")).toBe("https://exemplo.com.br");
    expect(normalizarSiteUrl("  http://exemplo.com.br/  ")).toBe("http://exemplo.com.br");
    expect(normalizarSiteUrl("https://exemplo.com.br.")).toBe("https://exemplo.com.br");
    expect(normalizarSiteUrl("https://exemplo.com.br:8080/x")).toBe("https://exemplo.com.br:8080");
    expect(normalizarSiteUrl("https://café.com.br")).toBe("https://xn--caf-dma.com.br");
    expect(normalizarSiteUrl("")).toBeNull();
    expect(normalizarSiteUrl("ftp://exemplo.com.br")).toBeNull();
    expect(normalizarSiteUrl("javascript:alert(1)")).toBeNull();
    expect(normalizarSiteUrl("localhost")).toBeNull();
    expect(normalizarSiteUrl("http://app.localhost:3000")).toBeNull();
    expect(normalizarSiteUrl("192.168.0.1")).toBeNull();
    expect(normalizarSiteUrl("http://[::1]/")).toBeNull();
    expect(normalizarSiteUrl("não é url")).toBeNull();
  });

  it("host verificado = sem www", () => {
    expect(dominioDoSite("https://www.Exemplo.com.br")).toBe("exemplo.com.br");
    expect(dominioDoSite("https://loja.exemplo.com.br/x")).toBe("loja.exemplo.com.br");
    expect(dominioDoSite("https://exemplo.com.br.")).toBe("exemplo.com.br");
    expect(dominioDoSite("http://10.0.0.1")).toBeNull();
    expect(dominioDoSite(null)).toBeNull();
    expect(dominioDoSite("lixo")).toBeNull();
    expect(dominioDoSite("ftp://exemplo.com")).toBeNull();
  });

  it("domínio registrável e nome do TXT", () => {
    expect(dominioRegistravel("exemplo.com.br")).toBe("exemplo.com.br");
    expect(dominioRegistravel("loja.exemplo.com.br")).toBe("exemplo.com.br");
    expect(dominioRegistravel("a.b.exemplo.com")).toBe("exemplo.com");
    expect(dominioRegistravel("shop.exemplo.co.uk")).toBe("exemplo.co.uk");
    expect(nomeRegistroTxt("exemplo.com.br")).toBe("@");
    expect(nomeRegistroTxt("exemplo.com")).toBe("@");
    expect(nomeRegistroTxt("loja.exemplo.com.br")).toBe("loja");
    expect(nomeRegistroTxt("a.b.exemplo.com")).toBe("a.b");
  });

  it("plataformas", () => {
    expect(plataformaDoSite("https://fulano.wixsite.com")).toBe("wixsite.com");
    expect(plataformaDoSite("https://www.loja.myshopify.com")).toBe("myshopify.com");
    expect(plataformaDoSite("https://padaria.negocio.site")).toBe("negocio.site");
    expect(plataformaDoSite("https://exemplo.com.br")).toBeNull();
    expect(plataformaDoSite("https://notwixsite.com")).toBeNull();
    expect(plataformaDoSite(null)).toBeNull();
  });

  it("snippet só com G-XXXX real", () => {
    expect(snippetGa4("G-ABC123")).toContain("gtag/js?id=G-ABC123");
    expect(snippetGa4("G-ABC123")).toContain("gtag('config','G-ABC123')");
    expect(snippetGa4(GA4_PENDENTE)).toBeNull();
    expect(snippetGa4(null)).toBeNull();
    expect(measurementIdValido(GA4_PENDENTE)).toBeNull();
    expect(measurementIdValido("G-ABC123")).toBe("G-ABC123");
  });

  it("mensagem do DNS", () => {
    expect(mensagemVerificacaoDns({ dominio: "exemplo.com.br", nome: "@", txt: "google-site-verification=xyz" }))
      .toContain("domínio exemplo.com.br um registro do tipo TXT, nome @ (ou em branco), com o valor: google-site-verification=xyz.");
    expect(mensagemVerificacaoDns({ dominio: "exemplo.com.br", nome: "loja", txt: "t" }))
      .toContain("domínio exemplo.com.br um registro do tipo TXT, nome loja, com o valor: t.");
  });
});
