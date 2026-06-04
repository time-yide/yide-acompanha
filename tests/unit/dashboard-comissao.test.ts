import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromMock }),
}));

// getComissaoPrevista usa service-role (colunas sensíveis REVOKEadas do
// role authenticated). Aponta pro mesmo fromMock pra reuso dos mocks
// por-tabela já definidos em cada teste.
vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

import { getComissaoPrevista } from "@/lib/dashboard/comissao-prevista";

beforeEach(() => {
  fromMock.mockReset();
});

/** Mock que suporta N chamadas encadeadas de .eq()/.is() antes de resolver. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeChainableEqMock(data: unknown[]): any {
  const resolved = Promise.resolve({ data });
  const chainable = {
    eq: vi.fn(),
    is: vi.fn(),
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  chainable.eq.mockReturnValue(chainable);
  chainable.is.mockReturnValue(chainable);
  return chainable;
}

/** Mock de profiles: select().eq().single() → profile. */
function mockProfile(profile: {
  fixo_mensal: number;
  comissao_percent: number;
  comissao_primeiro_mes_percent: number;
}) {
  return {
    select: () => ({
      eq: () => ({ single: vi.fn().mockResolvedValue({ data: profile }) }),
    }),
  };
}

/** Mock de clientes do assessor: select().eq(status).eq(tipo_relacao).is(deleted_at).eq(assessor_id). */
function mockClientsQuery(
  rows: Array<{ id: string; valor_mensal: number; tipo_relacao: string; data_entrada?: string }>,
) {
  return { select: () => makeChainableEqMock(rows) };
}

/** Mock de ajustes mensais: select().in().eq() → data. */
function mockAdjustments(rows: unknown[]) {
  return {
    select: () => ({
      in: () => ({ eq: vi.fn().mockResolvedValue({ data: rows }) }),
    }),
  };
}

const ABRIL_2026 = new Date(Date.UTC(2026, 3, 28));

describe("getComissaoPrevista", () => {
  it("assessor: usa a comissao_percent FIXA da carteira, sem bônus de primeiro mês", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return mockProfile({ fixo_mensal: 3000, comissao_percent: 5, comissao_primeiro_mes_percent: 20 });
      }
      if (table === "clients") {
        return mockClientsQuery([
          // entrou no mês corrente — NÃO deve ganhar bônus de 1º mês
          { id: "c1", valor_mensal: 6000, tipo_relacao: "comum", data_entrada: "2026-04-10" },
          { id: "c2", valor_mensal: 4000, tipo_relacao: "comum", data_entrada: "2025-01-01" },
        ]);
      }
      if (table === "client_monthly_adjustments") return mockAdjustments([]);
      return {};
    });

    const r = await getComissaoPrevista("u1", "assessor", ABRIL_2026);
    // base = 10000; 5% fixo = 500; + fixo 3000 = 3500
    expect(r.baseCalculo).toBe(10000);
    expect(r.percentual).toBe(5);
    expect(r.valorVariavel).toBe(500);
    expect(r.valor).toBe(3500);
  });

  it("assessor: exclui parceria/permuta e aplica gratuidade/desconto na base", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return mockProfile({ fixo_mensal: 0, comissao_percent: 10, comissao_primeiro_mes_percent: 0 });
      }
      if (table === "clients") {
        return mockClientsQuery([
          { id: "c1", valor_mensal: 5000, tipo_relacao: "comum" }, // conta cheio
          { id: "c2", valor_mensal: 9999, tipo_relacao: "parceria" }, // vale 0
          { id: "c3", valor_mensal: 5000, tipo_relacao: "comum" }, // gratuidade → 0
        ]);
      }
      if (table === "client_monthly_adjustments") {
        return mockAdjustments([
          { id: "a1", client_id: "c3", mes_referencia: "2026-04", tipo: "gratuidade_total", valor_desconto: null },
        ]);
      }
      return {};
    });

    const r = await getComissaoPrevista("u1", "assessor", ABRIL_2026);
    // base efetiva = só c1 = 5000; 10% = 500
    expect(r.baseCalculo).toBe(5000);
    expect(r.valorVariavel).toBe(500);
    expect(r.valor).toBe(500);
  });

  it("coordenador retorna apenas fixo (cálculo variável é pulado)", async () => {
    // Sócio/coordenador foram movidos pra "só fixo" — variável não conta.
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return mockProfile({ fixo_mensal: 5000, comissao_percent: 5, comissao_primeiro_mes_percent: 5 });
      }
      return {};
    });

    const r = await getComissaoPrevista("co1", "coordenador", ABRIL_2026);
    expect(r.valor).toBe(5000);
    expect(r.baseCalculo).toBe(0);
    expect(r.percentual).toBe(0);
  });

  it("calcula para comercial: soma valor_proposto de leads fechados no mês × percentual + fixo", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return mockProfile({ fixo_mensal: 2000, comissao_percent: 10, comissao_primeiro_mes_percent: 10 });
      }
      if (table === "leads") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                is: () => ({
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
          }),
        };
      }
      return {};
    });

    const r = await getComissaoPrevista("u1", "comercial", ABRIL_2026);
    // (50000 + 30000) × 10% = 8000; + fixo 2000 = 10000
    expect(r.valor).toBe(10000);
    expect(r.baseCalculo).toBe(80000);
  });

  it("retorna fixo apenas quando user não tem nada (sem clientes/leads)", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return mockProfile({ fixo_mensal: 2500, comissao_percent: 10, comissao_primeiro_mes_percent: 10 });
      }
      if (table === "clients") return mockClientsQuery([]);
      if (table === "client_monthly_adjustments") return mockAdjustments([]);
      return {};
    });

    const rA = await getComissaoPrevista("u1", "assessor", ABRIL_2026);
    expect(rA.valor).toBe(2500);
    expect(rA.baseCalculo).toBe(0);
  });
});
