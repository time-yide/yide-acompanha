import { describe, it, expect } from "vitest";
import { parseBulkImport } from "@/lib/clientes/import";

describe("parseBulkImport", () => {
  it("aceita TSV (colado do Excel) com 3 colunas", () => {
    const input = "Padaria Doce Vida\t5500\tSocial media + Tráfego\nLoja Verde\t3800\tSocial media";
    const r = parseBulkImport(input);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ nome: "Padaria Doce Vida", valor_mensal: 5500, servico_contratado: "Social media + Tráfego" });
    expect(r.rows[1]).toMatchObject({ nome: "Loja Verde", valor_mensal: 3800 });
    expect(r.errors).toHaveLength(0);
  });

  it("aceita CSV com 3 colunas", () => {
    const input = "Padaria, 5500, Social media\nLoja Verde, 3800, Tráfego pago";
    const r = parseBulkImport(input);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].valor_mensal).toBe(5500);
  });

  it("aceita valor com vírgula como decimal (formato BR)", () => {
    const input = "Padaria\t5500,50\tSocial media";
    const r = parseBulkImport(input);
    expect(r.rows[0].valor_mensal).toBe(5500.5);
  });

  it("aceita valor com R$ e pontuação BR", () => {
    const input = "Padaria\tR$ 5.500,00\tSocial media";
    const r = parseBulkImport(input);
    expect(r.rows[0].valor_mensal).toBe(5500);
  });

  it("aceita linha sem serviço (só nome e valor)", () => {
    const input = "Padaria\t5500";
    const r = parseBulkImport(input);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].servico_contratado).toBeNull();
    expect(r.errors).toHaveLength(0);
  });

  it("ignora linhas vazias", () => {
    const input = "Padaria\t5500\n\n\nLoja\t3800";
    const r = parseBulkImport(input);
    expect(r.rows).toHaveLength(2);
  });

  it("registra erro para nome ausente", () => {
    const input = "\t5500\tServiço";
    const r = parseBulkImport(input);
    expect(r.rows).toHaveLength(0);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].message).toMatch(/nome/i);
  });

  it("registra erro para valor inválido", () => {
    const input = "Padaria\tabc\tServiço";
    const r = parseBulkImport(input);
    expect(r.rows).toHaveLength(0);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].message).toMatch(/valor/i);
  });

  it("aceita header opcional (Nome, Valor, Serviço) e ignora", () => {
    const input = "Nome\tValor\tServiço\nPadaria\t5500\tSocial media";
    const r = parseBulkImport(input);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].nome).toBe("Padaria");
  });
});
