import { describe, it, expect } from "vitest";
import { montarLlmsFull } from "@/lib/site/llms-full";

describe("montarLlmsFull", () => {
  const txt = montarLlmsFull({
    siteUrl: "https://yidedigital.com.br",
    cases: [{ cliente: "Kai Poke", segmento: "Restaurante", slug: "kai" }],
    posts: [{ titulo: "Quanto custa tráfego pago", slug: "quanto-custa", resumo: "Guia" }],
  });
  it("traz dados da empresa e áreas atendidas", () => {
    expect(txt).toContain("# Yide Digital");
    expect(txt).toContain("WhatsApp: +55 65 99306-3452");
    expect(txt).toContain("Atendimento: 24 horas, todos os dias");
  });
  it("traz cada serviço com resposta, entregas e perguntas", () => {
    expect(txt).toContain("## Gestão de Tráfego Pago");
    expect(txt).toContain("https://yidedigital.com.br/servicos/gestao-de-trafego");
    expect(txt).toContain("O que está incluído:");
    expect(txt).toContain("P: Quanto investir em tráfego pago para começar?");
  });
  it("traz as praças com as páginas locais", () => {
    expect(txt).toContain("## Onde a Yide atende");
    expect(txt).toContain("- Várzea Grande (MT):");
    expect(txt).toContain("https://yidedigital.com.br/servicos/gestao-de-trafego/varzea-grande");
  });
  it("traz cases, artigos e perguntas gerais", () => {
    expect(txt).toContain("- [Kai Poke (Restaurante)](https://yidedigital.com.br/cases/kai)");
    expect(txt).toContain("- [Quanto custa tráfego pago](https://yidedigital.com.br/blog/quanto-custa): Guia");
    expect(txt).toContain("P: Onde fica a Yide Digital?");
  });
});
