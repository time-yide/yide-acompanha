// tests/unit/blog-insights-calc.test.ts
import { describe, it, expect } from "vitest";
import {
  ehBot,
  diaBRT,
  agruparVisitasPorDia,
  contarVisitasPorPost,
  rankearKeywords,
} from "@/lib/blog/insights-calc";

describe("ehBot", () => {
  it("detecta bots comuns", () => {
    expect(ehBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(ehBot("facebookexternalhit/1.1")).toBe(true);
    expect(ehBot("WhatsApp/2.2")).toBe(true);
    expect(ehBot("curl/8.1")).toBe(true);
  });
  it("sem user-agent conta como bot", () => {
    expect(ehBot("")).toBe(true);
  });
  it("navegador real não é bot", () => {
    expect(ehBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1")).toBe(false);
    expect(ehBot("Mozilla/5.0 (Windows NT 10.0) Chrome/120.0")).toBe(false);
  });
});

describe("diaBRT", () => {
  it("00:00 UTC vira o dia anterior em BRT (UTC-3)", () => {
    // 2026-07-19T01:00:00Z → 2026-07-18 22:00 BRT
    expect(diaBRT(Date.parse("2026-07-19T01:00:00Z"))).toBe("2026-07-18");
  });
  it("meio-dia UTC continua no mesmo dia em BRT", () => {
    expect(diaBRT(Date.parse("2026-07-19T12:00:00Z"))).toBe("2026-07-19");
  });
});

describe("agruparVisitasPorDia", () => {
  const hoje = Date.parse("2026-07-19T12:00:00Z"); // 09:00 BRT dia 19
  it("cobre todos os dias, inclusive os sem visita (total 0)", () => {
    const r = agruparVisitasPorDia([], hoje, 3);
    expect(r.map((x) => x.dia)).toEqual(["2026-07-17", "2026-07-18", "2026-07-19"]);
    expect(r.every((x) => x.total === 0)).toBe(true);
  });
  it("conta visitas no balde certo e ignora fora da janela", () => {
    const datas = [
      "2026-07-19T13:00:00Z", // dia 19
      "2026-07-19T15:00:00Z", // dia 19
      "2026-07-18T14:00:00Z", // dia 18
      "2026-07-10T14:00:00Z", // fora da janela
    ];
    const r = agruparVisitasPorDia(datas, hoje, 3);
    expect(r.find((x) => x.dia === "2026-07-19")?.total).toBe(2);
    expect(r.find((x) => x.dia === "2026-07-18")?.total).toBe(1);
  });
  it("ignora datas inválidas", () => {
    const r = agruparVisitasPorDia(["nao-e-data"], hoje, 2);
    expect(r.reduce((s, x) => s + x.total, 0)).toBe(0);
  });
});

describe("contarVisitasPorPost", () => {
  it("conta ocorrências por id", () => {
    expect(contarVisitasPorPost(["a", "b", "a", "a"])).toEqual({ a: 3, b: 1 });
  });
  it("lista vazia vira objeto vazio", () => {
    expect(contarVisitasPorPost([])).toEqual({});
  });
});

describe("rankearKeywords", () => {
  it("agrega case-insensitive e ordena por frequência", () => {
    const r = rankearKeywords([["SEO", "Cuiabá"], ["seo", "IA"], ["seo"]]);
    expect(r[0]).toEqual({ keyword: "seo", total: 3 });
  });
  it("desempata alfabeticamente", () => {
    const r = rankearKeywords([["banana", "abacaxi"]]);
    expect(r.map((x) => x.keyword)).toEqual(["abacaxi", "banana"]);
  });
  it("respeita o limite", () => {
    const r = rankearKeywords([["a", "b", "c", "d"]], 2);
    expect(r).toHaveLength(2);
  });
  it("ignora keywords vazias", () => {
    const r = rankearKeywords([["  ", "seo", ""]]);
    expect(r).toEqual([{ keyword: "seo", total: 1 }]);
  });
});
