import { describe, it, expect } from "vitest";
import { aggregateAnuncios, type AnuncioAggRow } from "@/lib/ecommerce/aggregate";

const rows: AnuncioAggRow[] = [
  { data: "2026-07-01", quantidade: 10, marketplace: "mercado_livre",
    colaborador_id: "a1", colaborador_nome: "Ana", client_id: "c1", client_nome: "Loja X" },
  { data: "2026-07-01", quantidade: 5, marketplace: "shopee",
    colaborador_id: "a1", colaborador_nome: "Ana", client_id: "c2", client_nome: "Loja Y" },
  { data: "2026-07-02", quantidade: 8, marketplace: "mercado_livre",
    colaborador_id: "a2", colaborador_nome: "Bia", client_id: "c1", client_nome: "Loja X" },
];

describe("aggregateAnuncios", () => {
  it("soma os KPIs", () => {
    const r = aggregateAnuncios(rows);
    expect(r.kpis.total).toBe(23);
    expect(r.kpis.clientes).toBe(2);
    expect(r.kpis.assessores).toBe(2);
    expect(r.kpis.dias).toBe(2);
  });

  it("ranking por assessor em ordem decrescente", () => {
    const r = aggregateAnuncios(rows);
    expect(r.porAssessor).toEqual([
      { id: "a1", nome: "Ana", total: 15 },
      { id: "a2", nome: "Bia", total: 8 },
    ]);
  });

  it("total por cliente em ordem decrescente", () => {
    const r = aggregateAnuncios(rows);
    expect(r.porCliente).toEqual([
      { id: "c1", nome: "Loja X", total: 18 },
      { id: "c2", nome: "Loja Y", total: 5 },
    ]);
  });

  it("quebra por marketplace", () => {
    const r = aggregateAnuncios(rows);
    expect(r.porMarketplace).toEqual([
      { marketplace: "mercado_livre", total: 18 },
      { marketplace: "shopee", total: 5 },
    ]);
  });

  it("evolução no tempo em ordem crescente de data", () => {
    const r = aggregateAnuncios(rows);
    expect(r.porTempo).toEqual([
      { data: "2026-07-01", total: 15 },
      { data: "2026-07-02", total: 8 },
    ]);
  });

  it("lida com lista vazia", () => {
    const r = aggregateAnuncios([]);
    expect(r.kpis).toEqual({ total: 0, clientes: 0, assessores: 0, dias: 0 });
    expect(r.porAssessor).toEqual([]);
    expect(r.porCliente).toEqual([]);
    expect(r.porMarketplace).toEqual([]);
    expect(r.porTempo).toEqual([]);
  });

  it("agrupa 'sem assessor' quando colaborador_id é null", () => {
    const r = aggregateAnuncios([
      { data: "2026-07-01", quantidade: 3, marketplace: "outro",
        colaborador_id: null, colaborador_nome: null, client_id: "c1", client_nome: "Loja X" },
    ]);
    expect(r.porAssessor).toEqual([{ id: "sem", nome: "Sem assessor", total: 3 }]);
  });
});
