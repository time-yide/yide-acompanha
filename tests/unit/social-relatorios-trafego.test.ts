import { describe, it, expect } from "vitest";
import { agregarTrafego, type MetricaTrafegoRaw } from "@/lib/social-media/relatorios/trafego-dados";

const campanhas = [
  { id: "c1", nome: "Campanha A" },
  { id: "c2", nome: "Campanha B" },
];

const metricas: MetricaTrafegoRaw[] = [
  { campanha_id: "c1", metrica_key: "spend", valor: 100 },
  { campanha_id: "c1", metrica_key: "impressions", valor: 1000 },
  { campanha_id: "c1", metrica_key: "clicks", valor: 50 },
  { campanha_id: "c1", metrica_key: "leads", valor: 5 },
  { campanha_id: "c2", metrica_key: "spend", valor: 300 },
  { campanha_id: "c2", metrica_key: "impressions", valor: 4000 },
  { campanha_id: "c2", metrica_key: "clicks", valor: 100 },
  { campanha_id: "c2", metrica_key: "conversions", valor: 8 },
];

describe("agregarTrafego", () => {
  const d = agregarTrafego(campanhas, metricas);

  it("soma o gasto total", () => {
    expect(d.spend).toBe(400);
  });

  it("soma impressões e cliques", () => {
    expect(d.impressoes).toBe(5000);
    expect(d.cliques).toBe(150);
  });

  it("calcula CPC (spend/cliques)", () => {
    expect(d.cpc).toBeCloseTo(400 / 150);
  });

  it("calcula CTR (cliques/impressões %)", () => {
    expect(d.ctr).toBeCloseTo((150 / 5000) * 100);
  });

  it("top_campanhas ordenado por gasto (c2 primeiro)", () => {
    expect(d.top_campanhas[0].nome).toBe("Campanha B");
    expect(d.top_campanhas[0].spend).toBe(300);
  });

  it("sem dados → tudo zero, sem quebrar", () => {
    const vazio = agregarTrafego([], []);
    expect(vazio.spend).toBe(0);
    expect(vazio.cpc).toBe(0);
    expect(vazio.top_campanhas).toEqual([]);
  });
});
