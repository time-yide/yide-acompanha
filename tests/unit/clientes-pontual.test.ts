import { describe, it, expect } from "vitest";
import { dataConclusaoPontual, pontualMesEncerrado } from "@/lib/clientes/pontual";

describe("dataConclusaoPontual", () => {
  it("retorna o último dia do mês de entrada", () => {
    expect(dataConclusaoPontual("2026-05-10")).toBe("2026-05-31");
    expect(dataConclusaoPontual("2026-02-03")).toBe("2026-02-28");
    expect(dataConclusaoPontual("2024-02-15")).toBe("2024-02-29"); // bissexto
    expect(dataConclusaoPontual("2026-06-30")).toBe("2026-06-30");
  });
});

describe("pontualMesEncerrado", () => {
  it("false durante o mês de entrada (inclui o último dia)", () => {
    expect(pontualMesEncerrado("2026-06-01", "2026-06-12")).toBe(false);
    expect(pontualMesEncerrado("2026-06-30", "2026-06-30")).toBe(false);
  });
  it("true a partir do 1º dia do mês seguinte", () => {
    expect(pontualMesEncerrado("2026-05-10", "2026-06-01")).toBe(true);
    expect(pontualMesEncerrado("2026-06-30", "2026-07-01")).toBe(true);
  });
});
