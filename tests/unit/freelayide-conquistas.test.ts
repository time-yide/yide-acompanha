import { describe, it, expect } from "vitest";
import { conquistasAtingidas, progressoDe, CONQUISTAS } from "@/lib/freela-yide/conquistas";
import type { ConquistaStats } from "@/lib/freela-yide/conquistas";

const stats = (o: Partial<ConquistaStats>): ConquistaStats =>
  ({ pegas: 0, fechamentos: 0, pequenasFechadas: 0, valorFechado: 0, ...o });

describe("conquistasAtingidas", () => {
  it("zerado => nenhuma", () => {
    expect(conquistasAtingidas(stats({}))).toEqual([]);
  });
  it("pegas=1 => só estreia", () => {
    expect(conquistasAtingidas(stats({ pegas: 1 }))).toEqual(["estreia"]);
  });
  it("pegas=10 e fechamentos=10 => estreia, pegador, primeiro_gol, matador", () => {
    const r = conquistasAtingidas(stats({ pegas: 10, fechamentos: 10 }));
    expect(r).toEqual(expect.arrayContaining(["estreia", "pegador", "primeiro_gol", "matador"]));
    expect(r).not.toContain("formiga"); // precisa de 30
    expect(r).not.toContain("closer");  // precisa de 25
  });
  it("pequenasFechadas=5 => faxineiro; =15 => faxineiro + heroi_miudas", () => {
    expect(conquistasAtingidas(stats({ pequenasFechadas: 5 }))).toContain("faxineiro");
    expect(conquistasAtingidas(stats({ pequenasFechadas: 5 }))).not.toContain("heroi_miudas");
    const r15 = conquistasAtingidas(stats({ pequenasFechadas: 15 }));
    expect(r15).toEqual(expect.arrayContaining(["faxineiro", "heroi_miudas"]));
  });
  it("valorFechado 3000 => provedor; 10000 => provedor + milionario", () => {
    expect(conquistasAtingidas(stats({ valorFechado: 3000 }))).toContain("provedor");
    expect(conquistasAtingidas(stats({ valorFechado: 3000 }))).not.toContain("milionario");
    expect(conquistasAtingidas(stats({ valorFechado: 10000 }))).toEqual(expect.arrayContaining(["provedor", "milionario"]));
  });
  it("borda: meta-1 não conta, meta conta", () => {
    expect(conquistasAtingidas(stats({ fechamentos: 9 }))).not.toContain("matador");
    expect(conquistasAtingidas(stats({ fechamentos: 10 }))).toContain("matador");
  });
});

describe("progressoDe", () => {
  it("usa o campo certo por categoria", () => {
    const s = stats({ pegas: 3, fechamentos: 7, pequenasFechadas: 2, valorFechado: 1234 });
    const byKey = Object.fromEntries(CONQUISTAS.map((c) => [c.key, progressoDe(c, s)]));
    expect(byKey.estreia).toBe(3);        // pegar
    expect(byKey.matador).toBe(7);        // fechar
    expect(byKey.faxineiro).toBe(2);      // pequenas
    expect(byKey.provedor).toBe(1234);    // valor
  });
});
