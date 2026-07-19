import { describe, it, expect } from "vitest";
import { extrairJson } from "@/lib/blog/pipeline/gerar";
import { ordenarPorData, filtrarNovas, type NoticiaItem } from "@/lib/blog/pipeline/rss";

const n = (link: string, publicadoEm: string | null): NoticiaItem =>
  ({ titulo: "t", link, resumo: "r", publicadoEm, fonteNome: "F" });

describe("extrairJson", () => {
  it("extrai JSON puro", () => {
    expect(extrairJson('{"titulo":"x","conteudo_md":"y"}')).toEqual({ titulo: "x", conteudo_md: "y" });
  });
  it("tolera cercas de código e texto ao redor", () => {
    const txt = "Aqui está:\n```json\n{\"titulo\":\"x\"}\n```\nfim";
    expect(extrairJson(txt)).toEqual({ titulo: "x" });
  });
  it("retorna null se não há JSON", () => {
    expect(extrairJson("sem json aqui")).toBeNull();
  });
});

describe("ordenarPorData", () => {
  it("recentes primeiro; sem data no fim", () => {
    const r = ordenarPorData([n("a", "2026-07-01"), n("b", null), n("c", "2026-07-10")]);
    expect(r.map((x) => x.link)).toEqual(["c", "a", "b"]);
  });
});

describe("filtrarNovas", () => {
  it("remove links já usados e duplicados", () => {
    const r = filtrarNovas([n("a", null), n("b", null), n("a", null)], new Set(["b"]));
    expect(r.map((x) => x.link)).toEqual(["a"]);
  });
});
