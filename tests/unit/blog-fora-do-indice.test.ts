import { describe, it, expect } from "vitest";
import { postIndexavel } from "@/lib/blog/fora-do-indice";

describe("postIndexavel", () => {
  it("esconde post fora do tema", () => {
    expect(postIndexavel("carros-autonomos-enfrentam-desafios-reais-o-que-waymo-nos-ensina-sobre-tecnologia-e-infraestrutura")).toBe(false);
  });
  it("mantém o resto, inclusive post novo", () => {
    expect(postIndexavel("um-post-novo-de-marketing")).toBe(true);
  });
});
