import { describe, it, expect } from "vitest";
import { derivarSkills } from "./derivar";
import type { StatsUsuario } from "@/lib/conquistas/stats";

const base: StatsUsuario = {
  mesesDeCasa: 8, tarefasConcluidas: 12, pesquisasRespondidas: 0,
  entregasAudiovisual: 0, ligacoesSaida: 0, metaBatida: 0, cardCompleto: 0, discFeito: 1,
};

describe("derivarSkills", () => {
  it("calcula nível por degraus (tarefas 12 → nível 2)", () => {
    const s = derivarSkills("designer", null, base);
    const design = s.find((x) => x.nome === "Design")!;
    expect(design.nivel).toBe(2);       // degraus [0,10,40,...] → passou 0 e 10
    expect(design.alvoProx).toBe(40);
    expect(design.atual).toBe(12);
  });
  it("xpGeral soma tempo de casa + tarefas", () => {
    const s = derivarSkills("assessor", "Sanguíneo", base); // Comunicação usa xpGeral = 8+12=20
    const com = s.find((x) => x.nome === "Comunicação")!;
    expect(com.atual).toBe(20);         // degraus [0,15,50,...] → nível 2
    expect(com.nivel).toBe(2);
  });
  it("deduplica skills repetidas por nome (cargo + temperamento)", () => {
    const s = derivarSkills("socio", "Colérico", base); // socio tem Liderança e Colérico também
    expect(s.filter((x) => x.nome === "Liderança")).toHaveLength(1);
  });
  it("sem temperamento retorna só as do cargo", () => {
    const s = derivarSkills("programacao", null, base);
    expect(s.map((x) => x.nome).sort()).toEqual(["Automação", "Código", "Lógica"]);
  });
  it("nível máximo devolve alvoProx null e barra cheia", () => {
    const s = derivarSkills("designer", null, { ...base, tarefasConcluidas: 999 });
    const design = s.find((x) => x.nome === "Design")!;
    expect(design.nivel).toBe(5);
    expect(design.alvoProx).toBeNull();
    expect(design.pctProx).toBe(100);
  });
});
