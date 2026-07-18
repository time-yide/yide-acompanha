import { describe, it, expect } from "vitest";
import { freelaColidente, type FreelaSlot } from "./freela-overlap";

const slot = (data_hora: string, duracao_min: number, titulo = "F"): FreelaSlot => ({ titulo, data_hora, duracao_min });

describe("freelaColidente", () => {
  it("colide quando os intervalos se sobrepõem", () => {
    const freelas = [slot("2026-07-20T17:00:00.000Z", 120)]; // 17:00–19:00 UTC
    expect(freelaColidente(freelas, "2026-07-20T18:00:00.000Z", "2026-07-20T18:30:00.000Z"))
      .toEqual(freelas[0]);
  });
  it("encostar não colide (fim == início)", () => {
    const freelas = [slot("2026-07-20T17:00:00.000Z", 120)]; // termina 19:00
    expect(freelaColidente(freelas, "2026-07-20T19:00:00.000Z", "2026-07-20T20:00:00.000Z")).toBeNull();
  });
  it("sem sobreposição → null", () => {
    const freelas = [slot("2026-07-20T17:00:00.000Z", 60)]; // 17:00–18:00
    expect(freelaColidente(freelas, "2026-07-20T15:00:00.000Z", "2026-07-20T16:00:00.000Z")).toBeNull();
  });
  it("duração inválida vira 60min", () => {
    const freelas = [slot("2026-07-20T17:00:00.000Z", 0)];
    expect(freelaColidente(freelas, "2026-07-20T17:30:00.000Z", "2026-07-20T17:45:00.000Z"))
      .toEqual(freelas[0]);
  });
  it("lista vazia → null", () => {
    expect(freelaColidente([], "2026-07-20T17:00:00.000Z", "2026-07-20T18:00:00.000Z")).toBeNull();
  });
});
