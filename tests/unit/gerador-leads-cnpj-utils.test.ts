import { describe, it, expect } from "vitest";
import { formatCnpj, stripCnpjFormat, isValidCnpjFormat } from "@/lib/gerador-leads/utils/cnpj";

describe("formatCnpj", () => {
  it("formata CNPJ sem máscara", () => {
    expect(formatCnpj("12345678000190")).toBe("12.345.678/0001-90");
  });
  it("retorna input se já vier formatado", () => {
    expect(formatCnpj("12.345.678/0001-90")).toBe("12.345.678/0001-90");
  });
  it("retorna null pra input null", () => {
    expect(formatCnpj(null)).toBe(null);
  });
  it("retorna input original se tiver tamanho errado", () => {
    expect(formatCnpj("123")).toBe("123");
  });
});

describe("stripCnpjFormat", () => {
  it("remove máscara", () => {
    expect(stripCnpjFormat("12.345.678/0001-90")).toBe("12345678000190");
  });
  it("retorna null pra null", () => {
    expect(stripCnpjFormat(null)).toBe(null);
  });
});

describe("isValidCnpjFormat", () => {
  it("aceita CNPJ de 14 dígitos limpo", () => {
    expect(isValidCnpjFormat("12345678000190")).toBe(true);
  });
  it("aceita CNPJ formatado", () => {
    expect(isValidCnpjFormat("12.345.678/0001-90")).toBe(true);
  });
  it("rejeita CNPJ curto", () => {
    expect(isValidCnpjFormat("123")).toBe(false);
  });
  it("rejeita null", () => {
    expect(isValidCnpjFormat(null)).toBe(false);
  });
});
