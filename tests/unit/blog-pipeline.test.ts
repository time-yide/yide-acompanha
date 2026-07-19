import { describe, it, expect } from "vitest";
import { extrairJson } from "@/lib/blog/pipeline/gerar";
import { ordenarPorData, filtrarNovas, apenasRecentes, type NoticiaItem } from "@/lib/blog/pipeline/rss";
import { frasesLocais, selecionarKeywordsAlvo } from "@/lib/blog/pipeline/keywords";

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

describe("apenasRecentes", () => {
  it("mantém só as dos últimos N dias (sem data passa)", () => {
    const agora = Date.parse("2026-07-18T12:00:00.000Z");
    const itens = [
      n("nova", "2026-07-16T00:00:00.000Z"),   // 2 dias
      n("velha", "2026-07-01T00:00:00.000Z"),  // 17 dias
      n("sem", null),
    ];
    const r = apenasRecentes(itens, 5, agora);
    expect(r.map((x) => x.link).sort()).toEqual(["nova", "sem"]);
  });
});

describe("keywords SEO local", () => {
  it("frasesLocais monta 'serviço em/de Cidade'", () => {
    const fs = frasesLocais();
    expect(fs).toContain("melhor marketing de Cuiabá");
    expect(fs).toContain("gestor de tráfego em Cuiabá");
    expect(fs.some((f) => f.includes("Salvador"))).toBe(true);
  });
  it("selecionarKeywordsAlvo devolve N itens não vazios", () => {
    const ks = selecionarKeywordsAlvo(4);
    expect(ks).toHaveLength(4);
    expect(ks.every((k) => k.length > 0)).toBe(true);
  });
});
