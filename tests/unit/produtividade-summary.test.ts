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
    custo_periodo: null,
    entregas_periodo: 0,
    custo_por_entrega: null,
    receita_periodo: null,
    lucro_periodo: null,
    ...over,
  };
}

describe("summarizeStatus — custo do período", () => {
  it("soma o custo do salário fixo de cada linha", () => {
    const rows = [
      row({ user_id: "a", custo_periodo: 100 }),
      row({ user_id: "b", custo_periodo: 250 }),
      row({ user_id: "c", custo_periodo: null }),
    ];
    const s = summarizeStatus(rows);
    expect(s.custo_periodo_total).toBe(350);
  });

  it("custo/hora médio ignora quem não tem fixo cadastrado", () => {
    const rows = [
      row({ user_id: "a", custo_hora: 20, custo_periodo: 100 }),
      row({ user_id: "b", custo_hora: 30, custo_periodo: 100 }),
      row({ user_id: "c", custo_hora: null }),
    ];
    const s = summarizeStatus(rows);
    expect(s.custo_hora_medio).toBe(25);
  });
});

describe("summarizeStatus — custo por entrega", () => {
  it("soma entregas e divide o custo total pelo total de entregas", () => {
    const rows = [
      row({ user_id: "a", custo_periodo: 300, entregas_periodo: 6 }),
      row({ user_id: "b", custo_periodo: 100, entregas_periodo: 4 }),
    ];
    const s = summarizeStatus(rows);
    expect(s.entregas_total).toBe(10);
    // (300 + 100) / 10 = 40
    expect(s.custo_por_entrega).toBe(40);
  });

  it("custo por entrega é null quando não houve entregas (sem divisão por zero)", () => {
    const rows = [
      row({ user_id: "a", custo_periodo: 300, entregas_periodo: 0 }),
    ];
    const s = summarizeStatus(rows);
    expect(s.entregas_total).toBe(0);
    expect(s.custo_por_entrega).toBeNull();
  });

  it("custo por entrega é null quando ninguém tem custo (só fixo zero)", () => {
    const rows = [
      row({ user_id: "a", custo_periodo: null, entregas_periodo: 5 }),
    ];
    const s = summarizeStatus(rows);
    expect(s.entregas_total).toBe(5);
    expect(s.custo_por_entrega).toBeNull();
  });
});

describe("summarizeStatus — time vazio", () => {
  it("não quebra e zera os totais", () => {
    const s = summarizeStatus([]);
    expect(s.custo_periodo_total).toBe(0);
    expect(s.entregas_total).toBe(0);
    expect(s.custo_por_entrega).toBeNull();
    expect(s.custo_hora_medio).toBeNull();
  });
});
