import { describe, it, expect } from "vitest";
import { parseCnpjaResponse } from "@/lib/gerador-leads/services/cnpja";

describe("parseCnpjaResponse", () => {
  it("extrai CNPJ e sócios do response esperado", () => {
    const raw = {
      taxId: "12345678000190",
      company: { name: "EMPRESA EXEMPLO LTDA" },
      alias: "Empresa Exemplo",
      members: [
        {
          person: { name: "JOÃO DA SILVA" },
          role: { text: "Sócio-Administrador" },
          since: "2020-03-15",
        },
        {
          person: { name: "MARIA SANTOS" },
          role: { text: "Sócio" },
          since: "2022-01-10",
        },
      ],
    };
    const result = parseCnpjaResponse(raw, false);
    expect(result.ok).toBe(true);
    expect(result.cnpj).toBe("12345678000190");
    expect(result.razao_social).toBe("EMPRESA EXEMPLO LTDA");
    expect(result.nome_fantasia).toBe("Empresa Exemplo");
    expect(result.socios).toHaveLength(2);
    expect(result.socios[0]).toEqual({
      nome: "JOÃO DA SILVA",
      qualificacao: "Sócio-Administrador",
      data_entrada: "2020-03-15",
    });
    expect(result.multiplos_resultados).toBe(false);
  });

  it("marca multiplos_resultados=true quando passado", () => {
    const raw = { taxId: "12345678000190", company: { name: "X" }, members: [] };
    const result = parseCnpjaResponse(raw, true);
    expect(result.multiplos_resultados).toBe(true);
  });

  it("retorna erro quando response não tem taxId", () => {
    const result = parseCnpjaResponse({}, false);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("taxId");
  });

  it("retorna socios vazio quando members ausente", () => {
    const raw = { taxId: "12345678000190", company: { name: "X" } };
    const result = parseCnpjaResponse(raw, false);
    expect(result.ok).toBe(true);
    expect(result.socios).toEqual([]);
  });
});
