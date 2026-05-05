import { describe, it, expect } from "vitest";
import { parseBulkExpenses } from "@/lib/financeiro/import";

describe("parseBulkExpenses", () => {
  it("aceita TAB e vírgula como separador", () => {
    const text = "Aluguel\taluguel\t5000\tfixa\nNotion,software,300,fixa";
    const r = parseBulkExpenses(text);
    expect(r.errors).toHaveLength(0);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].descricao).toBe("Aluguel");
    expect(r.rows[1].categoria).toBe("software");
  });

  it("ignora cabeçalho se primeira linha contém 'descricao'", () => {
    const text = "descricao,categoria,valor,tipo\nAluguel,aluguel,5000,fixa";
    const r = parseBulkExpenses(text);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].descricao).toBe("Aluguel");
  });

  it("avulsa exige mes_referencia", () => {
    const text = "iMac,equipamento,12000,avulsa";
    const r = parseBulkExpenses(text);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors[0].mensagem).toMatch(/mes_referencia/i);
  });

  it("avulsa com mes_referencia válido passa", () => {
    const text = "iMac,equipamento,12000,avulsa,2026-05";
    const r = parseBulkExpenses(text);
    expect(r.errors).toHaveLength(0);
    expect(r.rows[0].mes_referencia).toBe("2026-05");
  });

  it("rejeita categoria fora do enum", () => {
    const text = "Algo,inventada,100,fixa";
    const r = parseBulkExpenses(text);
    expect(r.errors[0].mensagem).toMatch(/categoria/i);
  });

  it("rejeita valor não-numérico", () => {
    const text = "Aluguel,aluguel,abc,fixa";
    const r = parseBulkExpenses(text);
    expect(r.errors[0].mensagem).toMatch(/valor/i);
  });

  it("ignora linhas vazias", () => {
    const text = "\n\nAluguel,aluguel,5000,fixa\n\n";
    const r = parseBulkExpenses(text);
    expect(r.rows).toHaveLength(1);
  });
});
