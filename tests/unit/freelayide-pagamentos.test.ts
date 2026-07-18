import { describe, it, expect } from "vitest";
import { agregarPagamentos } from "@/lib/freela-yide/pagamentos";
import type { PagamentoInput } from "@/lib/freela-yide/pagamentos";

const row = (pego_por: string, nome: string, valor: number, pego_em: string): PagamentoInput =>
  ({ pego_por, nome, valor_comissao: valor, pego_em });

describe("agregarPagamentos", () => {
  it("agrupa por mês e colaborador, somando valor e contando freelas", () => {
    const rows = [
      row("u1", "Ana", 150, "2026-07-05T12:00:00.000Z"),
      row("u1", "Ana", 100, "2026-07-20T12:00:00.000Z"),
      row("u2", "Beto", 500, "2026-07-10T12:00:00.000Z"),
    ];
    const [jul] = agregarPagamentos(rows);
    expect(jul.label).toBe("Julho 2026");
    expect(jul.total).toBe(750);
    // Beto (500) antes de Ana (250) — maior total primeiro
    expect(jul.colaboradores.map((c) => c.nome)).toEqual(["Beto", "Ana"]);
    const ana = jul.colaboradores.find((c) => c.nome === "Ana")!;
    expect(ana.qtd).toBe(2);
    expect(ana.total).toBe(250);
  });

  it("meses ordenados do mais recente pro mais antigo", () => {
    const rows = [
      row("u1", "Ana", 100, "2026-06-15T12:00:00.000Z"),
      row("u1", "Ana", 200, "2026-07-15T12:00:00.000Z"),
    ];
    expect(agregarPagamentos(rows).map((m) => m.chave)).toEqual(["2026-07", "2026-06"]);
  });

  it("empate no total desempata por nome A→Z", () => {
    const rows = [
      row("u2", "Zeca", 100, "2026-07-01T12:00:00.000Z"),
      row("u1", "Aline", 100, "2026-07-01T12:00:00.000Z"),
    ];
    expect(agregarPagamentos(rows)[0].colaboradores.map((c) => c.nome)).toEqual(["Aline", "Zeca"]);
  });

  it("lista vazia => sem meses", () => {
    expect(agregarPagamentos([])).toEqual([]);
  });
});
