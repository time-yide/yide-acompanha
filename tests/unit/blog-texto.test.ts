// tests/unit/blog-texto.test.ts
import { describe, it, expect } from "vitest";
import { semTravessao } from "@/lib/blog/texto";

describe("semTravessao", () => {
  it("troca travessão entre palavras por vírgula", () => {
    expect(semTravessao("o que importa — direto ao ponto")).toBe("o que importa, direto ao ponto");
  });
  it("troca meia-risca também", () => {
    expect(semTravessao("Pixel 11a – novo chip")).toBe("Pixel 11a, novo chip");
  });
  it("não deixa vírgula dupla", () => {
    expect(semTravessao("modelo Kimi, — gerando debates")).toBe("modelo Kimi, gerando debates");
  });
  it("não gera ', .' antes de pontuação", () => {
    expect(semTravessao("acessível —.")).toBe("acessível.");
  });
  it("não mexe em hífen comum", () => {
    expect(semTravessao("guarda-chuva e pós-venda")).toBe("guarda-chuva e pós-venda");
  });
  it("string vazia continua vazia", () => {
    expect(semTravessao("")).toBe("");
  });
});
