import { describe, expect, it } from "vitest";
import { primeiroDiaUtilDoMes, ultimoDiaUtilDoMes } from "./dias-uteis";

describe("ultimoDiaUtilDoMes", () => {
  it("mês que termina em dia útil", () => {
    expect(ultimoDiaUtilDoMes("2026-12-10")).toBe("2026-12-31"); // quinta
  });
  it("novembro/2026 termina numa segunda", () => {
    expect(ultimoDiaUtilDoMes("2026-11-25")).toBe("2026-11-30");
  });
  it("mês que termina no domingo volta pra sexta", () => {
    expect(ultimoDiaUtilDoMes("2026-05-10")).toBe("2026-05-29"); // 31/05/2026 é domingo
  });
  it("fevereiro", () => {
    expect(ultimoDiaUtilDoMes("2026-02-01")).toBe("2026-02-27"); // 28/02/2026 é sábado
  });
});

describe("primeiroDiaUtilDoMes", () => {
  it("dia 1 no fim de semana anda pra segunda", () => {
    expect(primeiroDiaUtilDoMes("2026-11-20")).toBe("2026-11-02"); // 01/11/2026 é domingo
  });
  it("dia 1 em dia útil", () => {
    expect(primeiroDiaUtilDoMes("2026-12-15")).toBe("2026-12-01"); // terça
  });
});
