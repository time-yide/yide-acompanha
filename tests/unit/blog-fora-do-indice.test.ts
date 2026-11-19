import { describe, it, expect } from "vitest";
import { postIndexavel } from "@/lib/blog/fora-do-indice";

describe("postIndexavel", () => {
  it("esconde post fora do tema", () => {
    expect(postIndexavel("carros-autonomos-enfrentam-desafios-reais-o-que-waymo-nos-ensina-sobre-tecnologia-e-infraestrutura")).toBe(false);
  });
  it("mantém o resto, inclusive post novo", () => {
    expect(postIndexavel("um-post-novo-de-marketing")).toBe(true);
  });
  it("esconde qualquer notícia (post com fonte_url)", () => {
    expect(postIndexavel("um-post-novo-de-marketing", "https://techcrunch.com/x")).toBe(false);
  });
  it("artigo próprio sem fonte continua indexável", () => {
    expect(postIndexavel("um-post-novo-de-marketing", null)).toBe(true);
  });
});
