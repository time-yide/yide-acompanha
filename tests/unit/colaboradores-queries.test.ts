import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { sortColaboradoresByName, filterColaboradoresByAdmissionAfter } from "@/lib/colaboradores/queries";

const baseColab = {
  id: "x",
  nome: "Zuzu",
  email: "zuzu@yide.com",
  role: "assessor" as const,
  ativo: true,
  fixo_mensal: 0,
  comissao_percent: 0,
  comissao_primeiro_mes_percent: 0,
  created_at: "2026-01-01T00:00:00Z",
  data_admissao: null as string | null,
  avatar_url: null as string | null,
};

describe("sortColaboradoresByName", () => {
  it("ordena alfabeticamente por nome ascendente", () => {
    const rows = [
      { ...baseColab, id: "a", nome: "Carlos" },
      { ...baseColab, id: "b", nome: "Ana" },
      { ...baseColab, id: "c", nome: "Beatriz" },
    ];
    const sorted = sortColaboradoresByName(rows);
    expect(sorted.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("trata acentos sem quebrar", () => {
    const rows = [
      { ...baseColab, id: "a", nome: "Ângela" },
      { ...baseColab, id: "b", nome: "Bruno" },
    ];
    const sorted = sortColaboradoresByName(rows);
    expect(sorted[0].id).toBe("a");
  });
});

describe("filterColaboradoresByAdmissionAfter", () => {
  it("retorna todos quando filtro é null/undefined", () => {
    const rows = [
      { ...baseColab, id: "a", data_admissao: "2025-01-01" },
      { ...baseColab, id: "b", data_admissao: null },
    ];
    expect(filterColaboradoresByAdmissionAfter(rows, undefined)).toHaveLength(2);
    expect(filterColaboradoresByAdmissionAfter(rows, null)).toHaveLength(2);
  });

  it("inclui apenas colaboradores admitidos depois da data", () => {
    const rows = [
      { ...baseColab, id: "a", data_admissao: "2025-01-01" },
      { ...baseColab, id: "b", data_admissao: "2026-04-01" },
      { ...baseColab, id: "c", data_admissao: null },
    ];
    expect(filterColaboradoresByAdmissionAfter(rows, "2026-01-01").map((r) => r.id)).toEqual(["b"]);
  });

  it("inclui colaboradores admitidos no mesmo dia (>=)", () => {
    const rows = [
      { ...baseColab, id: "a", data_admissao: "2026-01-01" },
      { ...baseColab, id: "b", data_admissao: "2025-12-31" },
    ];
    expect(filterColaboradoresByAdmissionAfter(rows, "2026-01-01").map((r) => r.id)).toEqual(["a"]);
  });
});
