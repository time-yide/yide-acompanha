import { describe, it, expect } from "vitest";
import { parseSummaryResponse } from "./summarizer";

describe("parseSummaryResponse", () => {
  it("extrai objeto JSON válido", () => {
    const raw = 'Claro! ```json\n{"resumo_geral":"Reunião de kickoff.","decisoes":["Fechar escopo"],"proximos_passos":["Enviar proposta"],"insights":[{"tipo":"sinal_compra","texto":"Cliente animado","timestamp_segundos":30,"citacao":"quero começar"}],"tarefas":[{"titulo":"Enviar proposta","descricao":"até sexta","citacao":"me manda","timestamp_segundos":60}]}\n```';
    const p = parseSummaryResponse(raw);
    expect(p).not.toBeNull();
    expect(p!.resumo_geral).toBe("Reunião de kickoff.");
    expect(p!.decisoes).toEqual(["Fechar escopo"]);
    expect(p!.insights[0].tipo).toBe("sinal_compra");
    expect(p!.tarefas[0].titulo).toBe("Enviar proposta");
  });
  it("tipo inválido cai pra oportunidade", () => {
    const p = parseSummaryResponse('{"resumo_geral":"x","insights":[{"tipo":"xpto","texto":"y"}]}');
    expect(p!.insights[0].tipo).toBe("oportunidade");
  });
  it("sem JSON → null", () => {
    expect(parseSummaryResponse("sem json aqui")).toBeNull();
  });
});
