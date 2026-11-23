import { describe, expect, it } from "vitest";
import { dominioDoSite, mensagemVerificacaoDns, normalizarSiteUrl, snippetGa4 } from "./site";

describe("dados/site", () => {
  it("normaliza pra origem", () => {
    expect(normalizarSiteUrl("https://www.Exemplo.com.br/contato?x=1")).toBe("https://www.exemplo.com.br");
    expect(normalizarSiteUrl("exemplo.com.br")).toBe("https://exemplo.com.br");
    expect(normalizarSiteUrl("  http://exemplo.com.br/  ")).toBe("http://exemplo.com.br");
    expect(normalizarSiteUrl("")).toBeNull();
    expect(normalizarSiteUrl("ftp://exemplo.com.br")).toBeNull();
    expect(normalizarSiteUrl("javascript:alert(1)")).toBeNull();
    expect(normalizarSiteUrl("localhost")).toBeNull();
    expect(normalizarSiteUrl("não é url")).toBeNull();
  });

  it("domínio sem www", () => {
    expect(dominioDoSite("https://www.Exemplo.com.br")).toBe("exemplo.com.br");
    expect(dominioDoSite("https://loja.exemplo.com.br/x")).toBe("loja.exemplo.com.br");
    expect(dominioDoSite(null)).toBeNull();
    expect(dominioDoSite("lixo")).toBeNull();
    expect(dominioDoSite("ftp://exemplo.com")).toBeNull();
  });

  it("snippet e mensagem", () => {
    expect(snippetGa4("G-ABC123")).toContain("gtag/js?id=G-ABC123");
    expect(snippetGa4("G-ABC123")).toContain("gtag('config','G-ABC123')");
    expect(mensagemVerificacaoDns("exemplo.com.br", "google-site-verification=xyz"))
      .toContain("domínio exemplo.com.br um registro do tipo TXT, nome @ (ou em branco), com o valor: google-site-verification=xyz.");
  });
});
