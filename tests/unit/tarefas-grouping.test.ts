import { describe, it, expect } from "vitest";
import {
  prazoUrgency,
  formatPrazoLabel,
  groupTasksByPrazo,
  groupTasksByCliente,
  groupTasksByResponsavel,
  groupTasksByPrioridade,
} from "@/lib/tarefas/grouping";

const TODAY = new Date(2026, 4, 4); // 4 mai 2026 (mês 0-indexed)
const TODAY_ISO = "2026-05-04";

function task(overrides: Partial<{
  id: string;
  due_date: string | null;
  status: "aberta" | "em_andamento" | "concluida";
  prioridade: "alta" | "media" | "baixa";
  cliente: { id: string; nome: string } | null;
  atribuido: { nome: string } | null;
}> = {}) {
  return {
    id: overrides.id ?? "t1",
    titulo: "Tarefa teste",
    prioridade: overrides.prioridade ?? ("media" as const),
    status: overrides.status ?? ("aberta" as const),
    due_date: overrides.due_date ?? null,
    client_id: null,
    cliente: overrides.cliente ?? null,
    atribuido: overrides.atribuido ?? null,
  };
}

describe("prazoUrgency", () => {
  it("retorna 'none' pra due_date null", () => {
    expect(prazoUrgency(null, TODAY)).toBe("none");
  });
  it("retorna 'overdue' pra data no passado", () => {
    expect(prazoUrgency("2026-05-01", TODAY)).toBe("overdue");
  });
  it("retorna 'today' pra hoje", () => {
    expect(prazoUrgency(TODAY_ISO, TODAY)).toBe("today");
  });
  it("retorna 'week' pra próximos 7 dias inclusive", () => {
    expect(prazoUrgency("2026-05-05", TODAY)).toBe("week");
    expect(prazoUrgency("2026-05-11", TODAY)).toBe("week");
  });
  it("retorna 'future' pra mais de 7 dias", () => {
    expect(prazoUrgency("2026-05-12", TODAY)).toBe("future");
  });
});

describe("formatPrazoLabel", () => {
  it("retorna '-' pra null", () => {
    expect(formatPrazoLabel(null, TODAY)).toBe("-");
  });
  it("retorna 'Hoje' pra hoje", () => {
    expect(formatPrazoLabel(TODAY_ISO, TODAY)).toBe("Hoje");
  });
  it("retorna 'Venceu há Nd' pra passado", () => {
    expect(formatPrazoLabel("2026-05-02", TODAY)).toBe("Venceu há 2d");
  });
  it("retorna 'Em Nd' pra próximos 7 dias", () => {
    expect(formatPrazoLabel("2026-05-07", TODAY)).toBe("Em 3d");
  });
  it("retorna data formatada pt-BR pra futuro distante", () => {
    expect(formatPrazoLabel("2026-06-15", TODAY)).toMatch(/15 de jun/);
  });
});

describe("groupTasksByPrazo", () => {
  it("classifica em 6 buckets (atrasadas/hoje/semana/sem_prazo/futuras/concluidas)", () => {
    const tasks = [
      task({ id: "a", due_date: "2026-05-01", status: "aberta" }),  // atrasada
      task({ id: "b", due_date: TODAY_ISO, status: "aberta" }),     // hoje
      task({ id: "c", due_date: "2026-05-08", status: "aberta" }),  // semana
      task({ id: "d", due_date: "2026-06-01", status: "aberta" }),  // futura
      task({ id: "e", due_date: null, status: "aberta" }),          // sem_prazo
      task({ id: "f", due_date: "2026-04-30", status: "concluida" }), // concluída
    ];
    const g = groupTasksByPrazo(tasks, TODAY);
    expect(g.atrasadas.map((t) => t.id)).toEqual(["a"]);
    expect(g.hoje.map((t) => t.id)).toEqual(["b"]);
    expect(g.semana.map((t) => t.id)).toEqual(["c"]);
    expect(g.futuras.map((t) => t.id)).toEqual(["d"]);
    expect(g.sem_prazo.map((t) => t.id)).toEqual(["e"]);
    expect(g.concluidas.map((t) => t.id)).toEqual(["f"]);
  });
  it("concluída sempre vai pra 'concluidas' independente do due_date", () => {
    const tasks = [task({ id: "x", due_date: TODAY_ISO, status: "concluida" })];
    const g = groupTasksByPrazo(tasks, TODAY);
    expect(g.concluidas).toHaveLength(1);
    expect(g.hoje).toHaveLength(0);
  });
});

describe("groupTasksByCliente", () => {
  it("agrupa por nome do cliente, sem cliente vai pra '(Sem cliente)'", () => {
    const tasks = [
      task({ id: "a", cliente: { id: "c1", nome: "Acme" } }),
      task({ id: "b", cliente: { id: "c1", nome: "Acme" } }),
      task({ id: "c", cliente: null }),
    ];
    const g = groupTasksByCliente(tasks);
    expect(g.get("Acme")?.map((t) => t.id)).toEqual(["a", "b"]);
    expect(g.get("(Sem cliente)")?.map((t) => t.id)).toEqual(["c"]);
  });
});

describe("groupTasksByResponsavel", () => {
  it("agrupa por nome do responsável, sem responsável vai pra '(Sem responsável)'", () => {
    const tasks = [
      task({ id: "a", atribuido: { nome: "Yasmin" } }),
      task({ id: "b", atribuido: null }),
    ];
    const g = groupTasksByResponsavel(tasks);
    expect(g.get("Yasmin")?.map((t) => t.id)).toEqual(["a"]);
    expect(g.get("(Sem responsável)")?.map((t) => t.id)).toEqual(["b"]);
  });
});

describe("groupTasksByPrioridade", () => {
  it("agrupa em alta/media/baixa", () => {
    const tasks = [
      task({ id: "a", prioridade: "alta" }),
      task({ id: "b", prioridade: "media" }),
      task({ id: "c", prioridade: "baixa" }),
    ];
    const g = groupTasksByPrioridade(tasks);
    expect(g.alta.map((t) => t.id)).toEqual(["a"]);
    expect(g.media.map((t) => t.id)).toEqual(["b"]);
    expect(g.baixa.map((t) => t.id)).toEqual(["c"]);
  });
});
