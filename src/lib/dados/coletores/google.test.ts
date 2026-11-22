import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { somarSessoesGa4 } from "./google";

describe("somarSessoesGa4", () => {
  it("usa o índice da dimensão dateRange", () => {
    const j = {
      dimensionHeaders: [{ name: "country" }, { name: "dateRange" }],
      rows: [
        { dimensionValues: [{ value: "BR" }, { value: "atual" }], metricValues: [{ value: "10" }] },
        { dimensionValues: [{ value: "BR" }, { value: "anterior" }], metricValues: [{ value: "4" }] },
        { dimensionValues: [{ value: "BR" }, { value: "outro" }], metricValues: [{ value: "99" }] },
      ],
    };
    expect(somarSessoesGa4(j)).toEqual({ sessoes: 10, sessoesAnt: 4 });
  });
  it("não quebra sem cabeçalho/linhas", () => {
    expect(somarSessoesGa4({})).toEqual({ sessoes: 0, sessoesAnt: 0 });
    expect(somarSessoesGa4({ dimensionHeaders: [{ name: "dateRange" }] })).toEqual({ sessoes: 0, sessoesAnt: 0 });
  });
});
