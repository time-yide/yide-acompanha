import { describe, it, expect } from "vitest";
import { destinoCanonico } from "@/lib/site/dominio";

const ativo = true;

describe("destinoCanonico", () => {
  it("não faz nada com a flag desligada", () => {
    expect(destinoCanonico("blog.yidedigital.com.br", "/blog/x", "", false)).toBeNull();
  });
  it("blog. vai para o apex mantendo o caminho", () => {
    expect(destinoCanonico("blog.yidedigital.com.br", "/blog/x", "?a=1", ativo)).toBe("https://yidedigital.com.br/blog/x?a=1");
    expect(destinoCanonico("blog.yidedigital.com.br", "/servicos", "", ativo)).toBe("https://yidedigital.com.br/servicos");
  });
  it("raiz do blog. vai para /blog", () => {
    expect(destinoCanonico("blog.yidedigital.com.br", "/", "", ativo)).toBe("https://yidedigital.com.br/blog");
  });
  it("conteúdo público no host do sistema vai para o apex", () => {
    expect(destinoCanonico("sistemaacompanha.yidedigital.com.br", "/blog/x", "", ativo)).toBe("https://yidedigital.com.br/blog/x");
    expect(destinoCanonico("sistemaacompanha.yidedigital.com.br", "/cases", "", ativo)).toBe("https://yidedigital.com.br/cases");
  });
  it("/site vira a home do apex", () => {
    expect(destinoCanonico("yidedigital.com.br", "/site", "", ativo)).toBe("https://yidedigital.com.br/");
    expect(destinoCanonico("sistemaacompanha.yidedigital.com.br", "/site", "", ativo)).toBe("https://yidedigital.com.br/");
  });
  it("não mexe no sistema nem no próprio apex", () => {
    expect(destinoCanonico("sistemaacompanha.yidedigital.com.br", "/clientes", "", ativo)).toBeNull();
    expect(destinoCanonico("sistemaacompanha.yidedigital.com.br", "/blogueiros", "", ativo)).toBeNull();
    expect(destinoCanonico("yidedigital.com.br", "/blog/x", "", ativo)).toBeNull();
  });
});
