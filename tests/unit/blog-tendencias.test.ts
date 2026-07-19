// tests/unit/blog-tendencias.test.ts
import { describe, it, expect } from "vitest";
import { montarPromptTendencias, parseTendencias } from "@/lib/blog/pipeline/tendencias";
import type { NoticiaItem } from "@/lib/blog/pipeline/rss";

const noticia = (titulo: string, fonteNome: string): NoticiaItem => ({
  titulo, fonteNome, link: "https://x/" + titulo, resumo: "", publicadoEm: null,
});

describe("montarPromptTendencias", () => {
  it("lista as manchetes numeradas com a fonte", () => {
    const p = montarPromptTendencias([noticia("OpenAI lança modelo", "TechCrunch")]);
    expect(p).toContain("1. [TechCrunch] OpenAI lança modelo");
    expect(p).toContain('"tendencias"');
  });
  it("inclui várias manchetes", () => {
    const p = montarPromptTendencias([noticia("A", "F1"), noticia("B", "F2")]);
    expect(p).toContain("1. [F1] A");
    expect(p).toContain("2. [F2] B");
  });
});

describe("parseTendencias", () => {
  it("valida e normaliza itens", () => {
    const r = parseTendencias({
      tendencias: [
        { tema: "IA generativa", motivo: "muitos lançamentos", angulo: "escrever pra PMEs", fontes: 4 },
      ],
    });
    expect(r).toHaveLength(1);
    expect(r[0]).toEqual({ tema: "IA generativa", motivo: "muitos lançamentos", angulo: "escrever pra PMEs", fontes: 4 });
  });
  it("descarta itens sem tema", () => {
    const r = parseTendencias({ tendencias: [{ motivo: "x" }, { tema: "", angulo: "y" }, { tema: "Ok" }] });
    expect(r.map((t) => t.tema)).toEqual(["Ok"]);
  });
  it("fontes inválido vira 0; strings faltando viram ''", () => {
    const r = parseTendencias({ tendencias: [{ tema: "T", fontes: "abc" }] });
    expect(r[0]).toEqual({ tema: "T", motivo: "", angulo: "", fontes: 0 });
  });
  it("limita a 8 tendências", () => {
    const muitos = Array.from({ length: 20 }, (_, i) => ({ tema: `T${i}` }));
    expect(parseTendencias({ tendencias: muitos })).toHaveLength(8);
  });
  it("entrada não-objeto ou sem array vira []", () => {
    expect(parseTendencias(null)).toEqual([]);
    expect(parseTendencias({})).toEqual([]);
    expect(parseTendencias({ tendencias: "x" } as unknown as Record<string, unknown>)).toEqual([]);
  });
});
