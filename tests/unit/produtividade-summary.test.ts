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
    receita_atribuida_periodo: null,
    lucro_periodo: null,
    ...over,
  };
}

describe("summarizeStatus — receita/lucro do período", () => {
  it("soma receita e lucro de cada linha pro total do summary", () => {
    const rows = [
      row({ user_id: "a", receita_atribuida_periodo: 1000, lucro_periodo: 200, custo_dia: 800 }),
      row({ user_id: "b", receita_atribuida_periodo: 500, lucro_periodo: -100, custo_dia: 600 }),
      row({ user_id: "c", receita_atribuida_periodo: 0, lucro_periodo: 0, custo_dia: 0 }),
    ];
    const s = summarizeStatus(rows);
    expect(s.receita_periodo_total).toBe(1500);
    expect(s.lucro_periodo_total).toBe(100);
  });

  it("ignora nulos (sem dados de salário) sem quebrar a soma", () => {
    const rows = [
      row({ user_id: "a", receita_atribuida_periodo: 500, lucro_periodo: 100 }),
      row({ user_id: "b", receita_atribuida_periodo: null, lucro_periodo: null }),
    ];
    const s = summarizeStatus(rows);
    expect(s.receita_periodo_total).toBe(500);
    expect(s.lucro_periodo_total).toBe(100);
  });

  it("lucro_periodo_total negativo quando o time inteiro custa mais do que rende", () => {
    const rows = [
      row({ user_id: "a", receita_atribuida_periodo: 100, lucro_periodo: -200 }),
      row({ user_id: "b", receita_atribuida_periodo: 100, lucro_periodo: -300 }),
    ];
    const s = summarizeStatus(rows);
    expect(s.lucro_periodo_total).toBe(-500);
  });
});
