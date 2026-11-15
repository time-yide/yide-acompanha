import { describe, it, expect } from "vitest";
import { ehParaEmpresario, separarPosts, temasDoPost } from "@/lib/blog/temas-empresario";

const p = (titulo: string, fonte_url: string | null = null, keywords: string[] = []) => ({ titulo, resumo: null, keywords, fonte_url });

describe("blog do empresário", () => {
  it("artigo estratégico é sempre do empresário", () => {
    expect(ehParaEmpresario(p("Como precificar meus produtos?"))).toBe(true);
  });
  it("notícia de plataforma sem impacto pro dono vai para o mercado", () => {
    expect(ehParaEmpresario(p("Twitch lança anúncios interativos: o que isso significa", "https://x"))).toBe(false);
    expect(ehParaEmpresario(p("Edits App Ganha Novos Recursos", "https://x"))).toBe(false);
  });
  it("notícia que toca no WhatsApp ou em anúncio fica no blog do empresário", () => {
    expect(ehParaEmpresario(p("Como aumentar pedidos pelo WhatsApp com anúncios", "https://x"))).toBe(true);
  });
  it("classifica pelos temas", () => {
    expect(temasDoPost(p("Como subir no ranking do iFood?"))).toContain("ecommerce-e-delivery");
    expect(temasDoPost(p("Como escolher uma agência de marketing em Cuiabá?"))).toContain("escolher-agencia");
  });
  it("filtra pelo tema e ignora tema inválido", () => {
    const posts = [p("Como subir no ranking do iFood?"), p("Como escolher uma agência de marketing?"), p("Twitch lança algo", "https://x")];
    expect(separarPosts(posts, "escolher-agencia").doEmpresario).toHaveLength(1);
    expect(separarPosts(posts, "xyz").doEmpresario).toHaveLength(2);
    expect(separarPosts(posts).mercado).toHaveLength(1);
  });
});
