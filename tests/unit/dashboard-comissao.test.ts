import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromMock }),
}));

import { getComissaoPrevista } from "@/lib/dashboard/comissao-prevista";

beforeEach(() => {
  fromMock.mockReset();
});

describe("getComissaoPrevista", () => {
  it("calcula para assessor: soma carteira × percentual + fixo", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { fixo_mensal: 3000, comissao_percent: 10, comissao_primeiro_mes_percent: 5 },
              }),
            }),
          }),
        };
      }
      if (table === "clients") {
        return {
          select: () => ({
            eq: () => ({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: "c1", valor_mensal: 5000, data_entrada: "2025-01-01" },
                  { id: "c2", valor_mensal: 4000, data_entrada: "2025-06-01" },
                ],
              }),
            }),
          }),
        };
      }
      return {};
    });

    const r = await getComissaoPrevista("u1", "assessor", new Date(Date.UTC(2026, 3, 28)));
    // Base: (5000 + 4000) × 10% = 900; + fixo 3000 = 3900
    expect(r.baseCalculo).toBe(9000);
    expect(r.fixo).toBe(3000);
    expect(r.percentual).toBe(10);
    expect(r.valor).toBe(3900);
  });

  it("aplica comissao_primeiro_mes_percent em clientes que entraram no mês corrente", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { fixo_mensal: 1000, comissao_percent: 10, comissao_primeiro_mes_percent: 20 },
              }),
            }),
          }),
        };
      }
      if (table === "clients") {
        return {
          select: () => ({
            eq: () => ({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: "c1", valor_mensal: 5000, data_entrada: "2026-04-15" },
                  { id: "c2", valor_mensal: 4000, data_entrada: "2025-01-01" },
                ],
              }),
            }),
          }),
        };
      }
      return {};
    });

    const r = await getComissaoPrevista("u1", "assessor", new Date(Date.UTC(2026, 3, 28)));
    // c1 (primeiro mês): 5000 × 20% = 1000
    // c2 (normal): 4000 × 10% = 400
    // total comissão variável: 1400; + fixo 1000 = 2400
    expect(r.valor).toBe(2400);
    expect(r.baseCalculo).toBe(9000);
  });

  it("calcula para coordenador filtrando por coordenador_id", async () => {
    const eqClientesByCoord = vi.fn().mockResolvedValue({
      data: [{ id: "c1", valor_mensal: 5000, data_entrada: "2025-01-01" }],
    });
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { fixo_mensal: 5000, comissao_percent: 5, comissao_primeiro_mes_percent: 5 },
              }),
            }),
          }),
        };
      }
      if (table === "clients") {
        return {
          select: () => ({ eq: () => ({ eq: eqClientesByCoord }) }),
        };
      }
      return {};
    });

    const r = await getComissaoPrevista("co1", "coordenador", new Date(Date.UTC(2026, 3, 28)));
    expect(r.valor).toBe(5250); // 5000 × 5% + 5000 fixo
  });

  it("calcula para comercial: soma valor_proposto de leads fechados no mês × percentual + fixo", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { fixo_mensal: 2000, comissao_percent: 10, comissao_primeiro_mes_percent: 10 },
              }),
            }),
          }),
        };
      }
      if (table === "leads") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gte: () => ({
                  lte: vi.fn().mockResolvedValue({
                    data: [
                      { id: "l1", valor_proposto: 50000, data_fechamento: "2026-04-10" },
                      { id: "l2", valor_proposto: 30000, data_fechamento: "2026-04-20" },
                    ],
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const r = await getComissaoPrevista("u1", "comercial", new Date(Date.UTC(2026, 3, 28)));
    // (50000 + 30000) × 10% = 8000; + fixo 2000 = 10000
    expect(r.valor).toBe(10000);
    expect(r.baseCalculo).toBe(80000);
  });

  it("retorna fixo apenas quando user não tem nada (sem clientes/leads)", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { fixo_mensal: 2500, comissao_percent: 10, comissao_primeiro_mes_percent: 10 },
              }),
            }),
          }),
        };
      }
      if (table === "clients") {
        return {
          select: () => ({ eq: () => ({ eq: vi.fn().mockResolvedValue({ data: [] }) }) }),
        };
      }
      if (table === "leads") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ gte: () => ({ lte: vi.fn().mockResolvedValue({ data: [] }) }) }),
            }),
          }),
        };
      }
      return {};
    });

    const rA = await getComissaoPrevista("u1", "assessor", new Date(Date.UTC(2026, 3, 28)));
    expect(rA.valor).toBe(2500);
    expect(rA.baseCalculo).toBe(0);
  });
});
