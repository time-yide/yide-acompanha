import { describe, it, expect } from "vitest";
import { buildUserPrompt, SYSTEM_PROMPT } from "@/lib/trafego/relatorios/prompt";

describe("buildUserPrompt", () => {
  it("inclui cliente, período, objetivo e dados", () => {
    const p = buildUserPrompt({
      cliente_nome: "Acme",
      periodo_inicio: "2026-04-01",
      periodo_fim: "2026-04-30",
      objetivo: "Mostrar leads de Marco Zero",
      dados: { spend: 1000 },
    });
    expect(p).toContain("Acme");
    expect(p).toContain("2026-04-01");
    expect(p).toContain("Marco Zero");
    expect(p).toContain('"spend": 1000');
  });

  it('usa "Não especificado" quando objetivo é null', () => {
    const p = buildUserPrompt({
      cliente_nome: "X", periodo_inicio: "2026-04-01", periodo_fim: "2026-04-30",
      objetivo: null, dados: { spend: 0 },
    });
    expect(p).toContain("Não especificado");
  });
});

describe("SYSTEM_PROMPT", () => {
  it("menciona estrutura obrigatória e identidade Yide", () => {
    expect(SYSTEM_PROMPT).toContain("Yide");
    expect(SYSTEM_PROMPT).toContain("grafico_barras");
    expect(SYSTEM_PROMPT).toContain("encerramento");
  });
});
