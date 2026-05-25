import { describe, it, expect } from "vitest";
import { summarizeStatus, type ColaboradorStatusRow } from "@/lib/produtividade/queries";

function row(over: Partial<ColaboradorStatusRow> = {}): ColaboradorStatusRow {
  return {
    user_id: "u",
    nome: "n",
    role: "assessor",
    avatar_url: null,
    last_seen_at: null,
    last_active_event_at: null,
    online: false,
    ativo: false,
    tempo_ativo_seg_hoje: 0,
    tempo_externo_seg_hoje: 0,
    eventos_hoje: 0,
    tarefas_atrasadas: 0,
    capturas_atrasadas: 0,
    custo_hora: null,
    custo_dia: null,
    horas_esperadas_periodo: 8,
    lucro_periodo: null,
    ...over,
  };
}

describe("summarizeStatus — lucro do período", () => {
  it("soma lucro de cada linha pro total do summary", () => {
    const rows = [
      row({ user_id: "a", lucro_periodo: 100 }),
      row({ user_id: "b", lucro_periodo: -200 }),
      row({ user_id: "c", lucro_periodo: 50 }),
    ];
    const s = summarizeStatus(rows);
    expect(s.lucro_periodo_total).toBe(-50);
    expect(s.horas_esperadas_periodo).toBe(8);
  });

  it("ignora nulos (sem dados de salário) sem quebrar a soma", () => {
    const rows = [
      row({ user_id: "a", lucro_periodo: 100 }),
      row({ user_id: "b", lucro_periodo: null }),
    ];
    const s = summarizeStatus(rows);
    expect(s.lucro_periodo_total).toBe(100);
  });

  it("expõe horas_esperadas pegando da 1ª row (vale pra todo time)", () => {
    const rows = [
      row({ user_id: "a", horas_esperadas_periodo: 40, lucro_periodo: -500 }),
      row({ user_id: "b", horas_esperadas_periodo: 40, lucro_periodo: 200 }),
    ];
    const s = summarizeStatus(rows);
    expect(s.horas_esperadas_periodo).toBe(40);
    expect(s.lucro_periodo_total).toBe(-300);
  });

  it("horas_esperadas é 0 quando time está vazio", () => {
    const s = summarizeStatus([]);
    expect(s.horas_esperadas_periodo).toBe(0);
    expect(s.lucro_periodo_total).toBe(0);
  });
});
