import { describe, it, expect } from "vitest";
import { buildTaskGraph, type GraphTask } from "@/lib/tarefas/graph";

const profiles = [{ id: "p1", nome: "Maria" }, { id: "p2", nome: "João" }];
const clientes = [{ id: "c1", nome: "Loja X" }, { id: "c2", nome: "Bar Y" }];

const tasks: GraphTask[] = [
  { id: "t1", titulo: "Arte feed", status: "aberta", prioridade: "alta", client_id: "c1", atribuido_a: "p1", participantes_ids: ["p2"] },
  { id: "t2", titulo: "Roteiro", status: "concluida", prioridade: "media", client_id: "c1", atribuido_a: "p2", participantes_ids: [] },
  { id: "t3", titulo: "Sem cliente", status: "aberta", prioridade: "baixa", client_id: null, atribuido_a: "p1", participantes_ids: [] },
];

describe("buildTaskGraph", () => {
  const { nodes, links } = buildTaskGraph(tasks, profiles, clientes);

  it("cria um nó por tarefa", () => {
    expect(nodes.filter((n) => n.type === "task")).toHaveLength(3);
  });

  it("cria hub de cliente só pros clientes usados (c1), não c2", () => {
    const cli = nodes.filter((n) => n.type === "cliente");
    expect(cli.map((n) => n.id)).toEqual(["cliente:c1"]);
    expect(cli[0].label).toBe("Loja X");
  });

  it("cria hub de pessoa pros envolvidos (p1, p2)", () => {
    const pes = nodes.filter((n) => n.type === "pessoa").map((n) => n.id).sort();
    expect(pes).toEqual(["pessoa:p1", "pessoa:p2"]);
  });

  it("liga tarefa ao cliente, responsável e participante", () => {
    const l1 = links.filter((l) => l.source === "task:t1");
    expect(l1.map((l) => l.target).sort()).toEqual(["cliente:c1", "pessoa:p1", "pessoa:p2"]);
  });

  it("tarefa sem cliente não cria link de cliente", () => {
    const l3 = links.filter((l) => l.source === "task:t3");
    expect(l3.map((l) => l.target)).toEqual(["pessoa:p1"]);
  });
});
