import { describe, it, expect, vi } from "vitest";

// Stub server-side modules so env validation doesn't run at import time
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { sortTasks, filterTasksByPrazo } from "@/lib/tarefas/queries";

const baseTask = {
  id: "t",
  titulo: "x",
  prioridade: "media" as const,
  status: "aberta" as const,
  due_date: null as string | null,
  client_id: null,
  atribuido: null,
  criador: null,
  cliente: null,
};

describe("sortTasks", () => {
  it("ordena por prazo asc, nulls por último", () => {
    const tasks = [
      { ...baseTask, id: "a", due_date: null },
      { ...baseTask, id: "b", due_date: "2026-05-10" },
      { ...baseTask, id: "c", due_date: "2026-05-01" },
    ];
    const sorted = sortTasks(tasks);
    expect(sorted.map((t) => t.id)).toEqual(["c", "b", "a"]);
  });

  it("desempate: prioridade alta primeiro entre tarefas de mesmo prazo", () => {
    const tasks = [
      { ...baseTask, id: "a", due_date: "2026-05-10", prioridade: "baixa" as const },
      { ...baseTask, id: "b", due_date: "2026-05-10", prioridade: "alta" as const },
      { ...baseTask, id: "c", due_date: "2026-05-10", prioridade: "media" as const },
    ];
    const sorted = sortTasks(tasks);
    expect(sorted.map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("desempate em ambas tarefas sem prazo: prioridade alta primeiro", () => {
    const tasks = [
      { ...baseTask, id: "a", due_date: null, prioridade: "baixa" as const },
      { ...baseTask, id: "b", due_date: null, prioridade: "alta" as const },
    ];
    const sorted = sortTasks(tasks);
    expect(sorted.map((t) => t.id)).toEqual(["b", "a"]);
  });
});

describe("filterTasksByPrazo", () => {
  const today = new Date("2026-04-27T12:00:00Z");

  it("'hoje' inclui tarefa com prazo de hoje", () => {
    const tasks = [
      { ...baseTask, id: "a", due_date: "2026-04-27" },
      { ...baseTask, id: "b", due_date: "2026-04-28" },
    ];
    expect(filterTasksByPrazo(tasks, "hoje", today).map((t) => t.id)).toEqual(["a"]);
  });

  it("'semana' inclui tarefas até daqui a 7 dias", () => {
    const tasks = [
      { ...baseTask, id: "a", due_date: "2026-04-27" },
      { ...baseTask, id: "b", due_date: "2026-05-04" }, // 7 dias
      { ...baseTask, id: "c", due_date: "2026-05-05" }, // 8 dias - excluir
    ];
    const result = filterTasksByPrazo(tasks, "semana", today).map((t) => t.id);
    expect(result).toContain("a");
    expect(result).toContain("b");
    expect(result).not.toContain("c");
  });

  it("'vencidas' inclui prazo no passado, exclui sem prazo", () => {
    const tasks = [
      { ...baseTask, id: "a", due_date: "2026-04-26" },
      { ...baseTask, id: "b", due_date: "2026-04-27" },
      { ...baseTask, id: "c", due_date: null },
    ];
    expect(filterTasksByPrazo(tasks, "vencidas", today).map((t) => t.id)).toEqual(["a"]);
  });

  it("'sem_prazo' inclui apenas due_date null", () => {
    const tasks = [
      { ...baseTask, id: "a", due_date: null },
      { ...baseTask, id: "b", due_date: "2026-04-27" },
    ];
    expect(filterTasksByPrazo(tasks, "sem_prazo", today).map((t) => t.id)).toEqual(["a"]);
  });

  it("'qualquer' retorna todas", () => {
    const tasks = [
      { ...baseTask, id: "a", due_date: null },
      { ...baseTask, id: "b", due_date: "2026-01-01" },
      { ...baseTask, id: "c", due_date: "2099-12-31" },
    ];
    expect(filterTasksByPrazo(tasks, "qualquer", today)).toHaveLength(3);
  });
});
