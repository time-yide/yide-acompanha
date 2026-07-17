// tests/unit/calendario-freela-events.test.ts
import { describe, it, expect } from "vitest";
import { freelaRowsToEvents, type FreelaAgendaRow } from "@/lib/calendario/freela-events";

const OWNER = "11111111-1111-1111-1111-111111111111";

function row(overrides: Partial<FreelaAgendaRow> = {}): FreelaAgendaRow {
  return {
    id: "aaaa",
    titulo: "Captação Loja X",
    data_hora: "2026-07-20T17:00:00.000Z", // 13:00 Cuiabá
    duracao_min: 90,
    status: "pega",
    tipo: "captacao",
    valor_comissao: 600,
    entrega_urgente: false,
    ...overrides,
  };
}

describe("freelaRowsToEvents", () => {
  it("mapeia uma oportunidade pega para CalendarEvent com origem freela", () => {
    const [e] = freelaRowsToEvents([row()], OWNER);
    expect(e.id).toBe("freela-aaaa");
    expect(e.origem).toBe("freela");
    expect(e.titulo).toBe("Captação Loja X");
    expect(e.link).toBe("/freela-yide");
    expect(e.inicio).toBe("2026-07-20T17:00:00.000Z");
    expect(e.fim).toBe("2026-07-20T18:30:00.000Z");
    expect(e.participantes_ids).toEqual([OWNER]);
    expect(e.freela).toEqual({ status: "pega", tipo: "captacao", valor_comissao: 600, urgente: false });
  });

  it("marca urgente quando entrega_urgente=true", () => {
    const [e] = freelaRowsToEvents([row({ entrega_urgente: true, tipo: "edicao" })], OWNER);
    expect(e.freela?.urgente).toBe(true);
  });

  it("ignora linhas sem data_hora", () => {
    expect(freelaRowsToEvents([row({ data_hora: null })], OWNER)).toEqual([]);
  });

  it("usa duração default de 60min quando duracao_min inválida (0)", () => {
    const [e] = freelaRowsToEvents([row({ data_hora: "2026-07-20T17:00:00.000Z", duracao_min: 0 })], OWNER);
    expect(e.fim).toBe("2026-07-20T18:00:00.000Z");
  });
});
