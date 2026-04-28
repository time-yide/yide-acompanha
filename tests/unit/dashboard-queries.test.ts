import { describe, it, expect } from "vitest";
import { monthRange, monthLabel, lastDayOfMonth, isInMonth } from "@/lib/dashboard/date-utils";

describe("monthRange", () => {
  it("retorna últimos 12 meses incluindo o atual em ordem cronológica", () => {
    const months = monthRange(12, new Date(Date.UTC(2026, 3, 28)));
    expect(months).toHaveLength(12);
    expect(months[0]).toBe("2025-05");
    expect(months[11]).toBe("2026-04");
  });

  it("retorna últimos 6 meses", () => {
    const months = monthRange(6, new Date(Date.UTC(2026, 3, 28)));
    expect(months).toEqual(["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04"]);
  });

  it("vira o ano corretamente", () => {
    const months = monthRange(3, new Date(Date.UTC(2026, 1, 15)));
    expect(months).toEqual(["2025-12", "2026-01", "2026-02"]);
  });
});

describe("monthLabel", () => {
  it("formata 'YYYY-MM' como 'Mês/AAAA' em pt-BR abreviado", () => {
    expect(monthLabel("2026-04")).toBe("Abr/2026");
    expect(monthLabel("2025-12")).toBe("Dez/2025");
  });
});

describe("lastDayOfMonth", () => {
  it("retorna último dia do mês como ISO date 'YYYY-MM-DD'", () => {
    expect(lastDayOfMonth("2026-02")).toBe("2026-02-28");
    expect(lastDayOfMonth("2024-02")).toBe("2024-02-29"); // ano bissexto
    expect(lastDayOfMonth("2026-12")).toBe("2026-12-31");
  });
});

describe("isInMonth", () => {
  it("retorna true se a data ISO está no mês especificado", () => {
    expect(isInMonth("2026-04-15", "2026-04")).toBe(true);
    expect(isInMonth("2026-04-01", "2026-04")).toBe(true);
    expect(isInMonth("2026-04-30", "2026-04")).toBe(true);
  });

  it("retorna false fora do mês", () => {
    expect(isInMonth("2026-03-31", "2026-04")).toBe(false);
    expect(isInMonth("2026-05-01", "2026-04")).toBe(false);
  });

  it("retorna false se data for null/undefined", () => {
    expect(isInMonth(null, "2026-04")).toBe(false);
    expect(isInMonth(undefined, "2026-04")).toBe(false);
  });
});

import { vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromMock }),
}));

import { getKpis } from "@/lib/dashboard/queries";

beforeEach(() => {
  fromMock.mockReset();
});

describe("getKpis", () => {
  it("calcula carteira ativa e clientes ativos a partir de clients ativos", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "clients") {
        return {
          select: () => ({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: "c1", valor_mensal: 5000, data_entrada: "2025-01-01", data_churn: null, status: "ativo" },
                { id: "c2", valor_mensal: 3000, data_entrada: "2025-06-01", data_churn: null, status: "ativo" },
                { id: "c3", valor_mensal: 4000, data_entrada: "2024-08-01", data_churn: "2026-04-15", status: "ativo" },
              ],
            }),
          }),
        };
      }
      if (table === "commission_snapshots") {
        return {
          select: () => ({
            order: () => ({
              limit: vi.fn().mockResolvedValue({
                data: [{ mes_referencia: "2026-03", valor_total: 800 }],
              }),
            }),
          }),
        };
      }
      return {};
    });

    const r = await getKpis(new Date(Date.UTC(2026, 3, 28)));
    // c1 e c2 são ativos sem churn; c3 churnou em abril (ainda no mês de referência)
    // Carteira ativa hoje (28/abr/2026): c1 + c2 = 8000 (c3 churnou em 15/abr, não está mais ativo)
    expect(r.carteiraAtiva.valor).toBe(8000);
    expect(r.clientesAtivos.quantidade).toBe(2);
    expect(r.churnMes.quantidade).toBe(1);    // c3 churnou em abril
    expect(r.churnMes.valorPerdido).toBe(4000);
    // Custo de comissão: 800 / 8000 = 10%
    expect(r.custoComissaoPct.pct).toBeCloseTo(10);
  });

  it("retorna zeros quando não há clientes", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "clients") {
        return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [] }) }) };
      }
      if (table === "commission_snapshots") {
        return { select: () => ({ order: () => ({ limit: vi.fn().mockResolvedValue({ data: [] }) }) }) };
      }
      return {};
    });

    const r = await getKpis(new Date(Date.UTC(2026, 3, 28)));
    expect(r.carteiraAtiva.valor).toBe(0);
    expect(r.clientesAtivos.quantidade).toBe(0);
    expect(r.churnMes.quantidade).toBe(0);
    expect(r.custoComissaoPct.pct).toBe(0);
  });
});
