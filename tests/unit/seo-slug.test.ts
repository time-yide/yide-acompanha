import { describe, it, expect } from "vitest";
import { slugPagina, caminhoPagina } from "@/lib/seo/slug";

describe("slugPagina", () => {
  it("combina serviço e localidade", () => {
    expect(slugPagina("gestao-de-trafego", "salvador")).toBe("gestao-de-trafego-salvador");
  });
});
describe("caminhoPagina", () => {
  it("monta o caminho público", () => {
    expect(caminhoPagina("gestao-de-trafego", "salvador")).toBe("/servicos/gestao-de-trafego/salvador");
  });
});
