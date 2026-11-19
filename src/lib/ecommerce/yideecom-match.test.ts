import { describe, it, expect } from "vitest";
import { casarPublicados, juntarAnuncios, normalizarNome } from "./yideecom-match";
import { aggregateAnuncios } from "./aggregate";

const clientes = [
  { id: "c1", nome: "Mr. Capy" },
  { id: "c2", nome: "Loja São João" },
];

describe("normalizarNome", () => {
  it("ignora acento, maiúscula e pontuação", () => {
    expect(normalizarNome("  Loja São-João!! ")).toBe("loja sao joao");
    expect(normalizarNome("MR CAPY")).toBe(normalizarNome("Mr. Capy"));
  });
});

describe("casarPublicados", () => {
  it("liga pelo nome e marca a origem como yideecom", () => {
    const { rows, semCliente } = casarPublicados(
      [
        { cliente_id: "y1", cliente_nome: "MR CAPY", data: "2026-11-10", marketplace: "mercado_livre", quantidade: 12 },
        { cliente_id: "y2", cliente_nome: "loja sao joao", data: "2026-11-11", marketplace: "tray", quantidade: 3 },
      ],
      clientes,
    );
    expect(semCliente).toEqual([]);
    expect(rows.map((r) => [r.client_id, r.client_nome, r.marketplace, r.quantidade, r.origem])).toEqual([
      ["c1", "Mr. Capy", "mercado_livre", 12, "yideecom"],
      ["c2", "Loja São João", "tray", 3, "yideecom"],
    ]);
    expect(rows[0].colaborador_id).toBeNull();
  });

  it("devolve os clientes sem par (sem repetir) e ignora quantidade zero", () => {
    const { rows, semCliente } = casarPublicados(
      [
        { cliente_id: "y9", cliente_nome: "Outra Loja", data: "2026-11-10", marketplace: "mercado_livre", quantidade: 2 },
        { cliente_id: "y9", cliente_nome: "Outra Loja", data: "2026-11-11", marketplace: "tray", quantidade: 1 },
        { cliente_id: "y1", cliente_nome: "Mr Capy", data: "2026-11-12", marketplace: "tray", quantidade: 0 },
      ],
      clientes,
    );
    expect(rows).toEqual([]);
    expect(semCliente).toEqual(["Outra Loja"]);
  });
});

describe("juntar + agregar", () => {
  it("ordena por data e conta o automático num grupo próprio", () => {
    const { rows } = casarPublicados(
      [{ cliente_id: "y1", cliente_nome: "Mr Capy", data: "2026-11-12", marketplace: "mercado_livre", quantidade: 5 }],
      clientes,
    );
    const manual = {
      id: "m1", data: "2026-11-15", quantidade: 2, marketplace: "shopee", observacao: null,
      colaborador_id: "u1", colaborador_nome: "Ana", colaborador_avatar_url: null,
      client_id: "c2", client_nome: "Loja São João", created_at: "2026-11-15T10:00:00Z",
    };
    const todos = juntarAnuncios([manual], rows);
    expect(todos.map((r) => r.id)).toEqual(["m1", rows[0].id]);
    const agg = aggregateAnuncios(todos);
    expect(agg.kpis.total).toBe(7);
    expect(agg.porAssessor).toEqual([
      { id: "yideecom", nome: "Automático (Yide Ecom)", total: 5 },
      { id: "u1", nome: "Ana", total: 2 },
    ]);
  });
});
