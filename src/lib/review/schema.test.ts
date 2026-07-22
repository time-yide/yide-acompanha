import { describe, it, expect } from "vitest";
import { podeTransicionar, type ReviewStatus } from "./schema";

describe("podeTransicionar", () => {
  it("interno → cliente é válido (aprovação interna)", () => {
    expect(podeTransicionar("revisao_interna", "revisao_cliente")).toBe(true);
  });
  it("cliente → aprovado e cliente → ajustes são válidos", () => {
    expect(podeTransicionar("revisao_cliente", "aprovado")).toBe(true);
    expect(podeTransicionar("revisao_cliente", "ajustes")).toBe(true);
  });
  it("ajustes → cliente (nova versão reenviada) é válido", () => {
    expect(podeTransicionar("ajustes", "revisao_cliente")).toBe(true);
  });
  it("aprovado é final — não sai dele", () => {
    expect(podeTransicionar("aprovado", "revisao_interna")).toBe(false);
  });
  it("pulos inválidos são bloqueados", () => {
    expect(podeTransicionar("revisao_interna", "aprovado")).toBe(false);
  });
});
