import { describe, it, expect } from "vitest";
import { computeTarefasMetricas, type MetricaTarefaInput } from "@/lib/tarefas/metricas";

const NOW = "2026-07-20T12:00:00Z";

function task(over: Partial<MetricaTarefaInput>): MetricaTarefaInput {
  return {
    id: over.id ?? "t1",
    titulo: over.titulo ?? "Tarefa",
    status: over.status ?? "aberta",
    due_date: over.due_date ?? null,
    updated_at: over.updated_at ?? NOW,
    created_at: over.created_at ?? NOW,
    completed_at: over.completed_at ?? null,
    atribuido_a: over.atribuido_a ?? null,
  };
}

describe("computeTarefasMetricas", () => {
  it("conta atrasada só quando está em aberto e o prazo passou", () => {
    const m = computeTarefasMetricas(
      [
        task({ id: "a", due_date: "2026-07-10" }), // 10 dias atrás, aberta → atrasada
        task({ id: "b", due_date: "2026-07-25" }), // futuro → não
        task({ id: "c", due_date: "2026-07-01", status: "postada" }), // entregue → não
      ],
      NOW,
    );
    expect(m.atrasadas.count).toBe(1);
    expect(m.atrasadas.top[0].id).toBe("a");
    expect(m.atrasadas.top[0].dias).toBe(10);
  });

  it("conta parada quando não há edição há 3+ dias (em aberto)", () => {
    const m = computeTarefasMetricas(
      [
        task({ id: "a", updated_at: "2026-07-15T12:00:00Z" }), // 5 dias → parada
        task({ id: "b", updated_at: "2026-07-19T12:00:00Z" }), // 1 dia → não
        task({ id: "c", updated_at: "2026-07-10T12:00:00Z", status: "concluida" }), // entregue → não
      ],
      NOW,
    );
    expect(m.paradas.count).toBe(1);
    expect(m.paradas.top[0].id).toBe("a");
    expect(m.paradas.top[0].dias).toBe(5);
  });

  it("conta sem prazo só entre as em aberto", () => {
    const m = computeTarefasMetricas(
      [
        task({ id: "a", due_date: null }),
        task({ id: "b", due_date: null, status: "postada" }),
      ],
      NOW,
    );
    expect(m.semPrazo).toBe(1);
    expect(m.emAberto).toBe(1);
  });

  it("tempo médio de conclusão usa completed_at − created_at", () => {
    const m = computeTarefasMetricas(
      [
        task({ id: "a", status: "concluida", created_at: "2026-07-01T00:00:00Z", completed_at: "2026-07-05T00:00:00Z" }), // 4d
        task({ id: "b", status: "concluida", created_at: "2026-07-01T00:00:00Z", completed_at: "2026-07-07T00:00:00Z" }), // 6d
      ],
      NOW,
    );
    expect(m.tempoMedioConclusaoDias).toBe(5);
  });

  it("tempo médio é null quando nada foi concluído", () => {
    const m = computeTarefasMetricas([task({ id: "a" })], NOW);
    expect(m.tempoMedioConclusaoDias).toBeNull();
  });
});
