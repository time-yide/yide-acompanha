import { describe, it, expect } from "vitest";
import { agregarCarga, agregarGargalos, concentracaoEntregas, type TarefaAbertaRow } from "@/lib/produtividade/capacidade";

const AGORA = Date.parse("2026-07-18T12:00:00.000Z");
const diasAtras = (d: number) => new Date(AGORA - d * 86_400_000).toISOString();

const pessoas = [
  { user_id: "u1", nome: "Ana", role: "assessor" },
  { user_id: "u2", nome: "Beto", role: "designer" },
  { user_id: "u3", nome: "Cid", role: "designer" },
];

describe("agregarCarga", () => {
  it("conta WIP, travadas (>5d sem update) e entregas por pessoa", () => {
    const abertas: TarefaAbertaRow[] = [
      { atribuido_a: "u1", updated_at: diasAtras(1) },   // recente
      { atribuido_a: "u1", updated_at: diasAtras(8) },   // parada
      { atribuido_a: "u2", updated_at: diasAtras(10) },  // parada
    ];
    const entregues = new Map([["u1", 3], ["u2", 0]]);
    const r = agregarCarga(abertas, pessoas, entregues, AGORA, 5);
    const byId = Object.fromEntries(r.map((p) => [p.user_id, p]));
    expect(byId.u1.wip).toBe(2);
    expect(byId.u1.travadas).toBe(1);
    expect(byId.u1.entregues).toBe(3);
    expect(byId.u2.wip).toBe(1);
    expect(byId.u2.travadas).toBe(1);
    expect(byId.u3.wip).toBe(0); // sem tarefa aberta
  });
  it("ordena por WIP desc", () => {
    const abertas: TarefaAbertaRow[] = [
      { atribuido_a: "u2", updated_at: diasAtras(1) },
      { atribuido_a: "u2", updated_at: diasAtras(1) },
      { atribuido_a: "u1", updated_at: diasAtras(1) },
    ];
    const r = agregarCarga(abertas, pessoas, new Map(), AGORA, 5);
    expect(r[0].user_id).toBe("u2"); // 2 WIP primeiro
  });
});

describe("agregarGargalos", () => {
  it("soma WIP por setor, maior primeiro", () => {
    const carga = [
      { user_id: "u1", nome: "Ana", role: "assessor", wip: 1, travadas: 0, entregues: 0 },
      { user_id: "u2", nome: "Beto", role: "designer", wip: 3, travadas: 0, entregues: 0 },
      { user_id: "u3", nome: "Cid", role: "designer", wip: 2, travadas: 0, entregues: 0 },
    ];
    const g = agregarGargalos(carga);
    expect(g[0]).toEqual({ setor: "design", wip: 5 }); // design 3+2 = gargalo
    expect(g[1]).toEqual({ setor: "assessoria", wip: 1 });
  });
});

describe("concentracaoEntregas", () => {
  it("calcula % do top 2 das entregas", () => {
    const carga = [
      { user_id: "u1", nome: "Ana", role: "assessor", wip: 0, travadas: 0, entregues: 6 },
      { user_id: "u2", nome: "Beto", role: "designer", wip: 0, travadas: 0, entregues: 3 },
      { user_id: "u3", nome: "Cid", role: "designer", wip: 0, travadas: 0, entregues: 1 },
    ];
    const c = concentracaoEntregas(carga, 2);
    expect(c.total).toBe(10);
    expect(c.topShare).toBe(90); // (6+3)/10
    expect(c.topNomes).toEqual(["Ana", "Beto"]);
  });
  it("sem entregas => topShare null", () => {
    expect(concentracaoEntregas([], 2).topShare).toBeNull();
  });
});
