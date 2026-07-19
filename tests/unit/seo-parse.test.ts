import { describe, it, expect } from "vitest";
import { parsePaginaGerada } from "@/lib/seo/gerar-parse";

describe("parsePaginaGerada", () => {
  it("valida e sanitiza (sem travessão)", () => {
    const r = parsePaginaGerada({ titulo: "Tráfego XX em Salvador".replace("XX", "—"),
      meta_title: "t", meta_description: "d", conteudo_md: "corpo — aqui",
      faq: [{ pergunta: "P?", resposta: "R — sim" }] });
    expect(r).not.toBeNull();
    expect(r!.titulo.includes("—")).toBe(false);
    expect(r!.faq[0].resposta.includes("—")).toBe(false);
  });
  it("retorna null sem título/conteúdo", () => {
    expect(parsePaginaGerada({ titulo: "" })).toBeNull();
    expect(parsePaginaGerada(null)).toBeNull();
  });
  it("faq inválida vira lista vazia", () => {
    const r = parsePaginaGerada({ titulo: "T", conteudo_md: "c", faq: "x" });
    expect(r!.faq).toEqual([]);
  });
});
