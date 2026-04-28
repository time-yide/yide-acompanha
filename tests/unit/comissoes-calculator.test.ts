import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

import { calculateCommission } from "@/lib/comissoes/calculator";

beforeEach(() => {
  fromMock.mockReset();
});

function mockProfile(profile: { id: string; role: string; fixo_mensal: number; comissao_percent: number; comissao_primeiro_mes_percent: number }) {
  return ({
    select: () => ({
      eq: () => ({
        single: vi.fn().mockResolvedValue({ data: profile }),
      }),
    }),
  });
}

function mockClientsQuery(rows: Array<{ valor_mensal: number; nome?: string; id?: string }>) {
  return ({
    select: () => ({
      eq: () => ({
        eq: vi.fn().mockResolvedValue({ data: rows }),
      }),
    }),
  });
}

function mockClientsAllAtivos(rows: Array<{ valor_mensal: number; nome?: string; id?: string }>) {
  return ({
    select: () => ({
      eq: vi.fn().mockResolvedValue({ data: rows }),
    }),
  });
}

function mockLeadsQuery(rows: Array<{ id: string; valor_proposto: number; client_id: string | null; cliente: { nome: string } | null }>) {
  return ({
    select: () => ({
      eq: () => ({
        gte: () => ({
          lte: vi.fn().mockResolvedValue({ data: rows }),
        }),
      }),
    }),
  });
}

describe("calculateCommission — Assessor", () => {
  it("calcula fixo + 5% de R$ 10.000 = R$ 500 variável", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return mockProfile({ id: "u1", role: "assessor", fixo_mensal: 3000, comissao_percent: 5, comissao_primeiro_mes_percent: 0 });
      }
      if (table === "clients") {
        return mockClientsQuery([{ valor_mensal: 6000, nome: "A" }, { valor_mensal: 4000, nome: "B" }]);
      }
      return {};
    });
    const r = await calculateCommission("u1", "2026-04");
    expect(r).not.toBeNull();
    expect(r!.snapshot.fixo).toBe(3000);
    expect(r!.snapshot.percentual_aplicado).toBe(5);
    expect(r!.snapshot.base_calculo).toBe(10000);
    expect(r!.snapshot.valor_variavel).toBe(500);
    expect(r!.items.length).toBe(2);
    expect(r!.items[0].tipo).toBe("fixo");
    expect(r!.items[1].tipo).toBe("carteira_assessor");
  });
});

describe("calculateCommission — Coordenador", () => {
  it("calcula fixo + 3% sobre carteira agência R$ 50.000 = R$ 1.500", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return mockProfile({ id: "u1", role: "coordenador", fixo_mensal: 5000, comissao_percent: 3, comissao_primeiro_mes_percent: 0 });
      }
      if (table === "clients") {
        return mockClientsAllAtivos([{ valor_mensal: 30000 }, { valor_mensal: 20000 }]);
      }
      return {};
    });
    const r = await calculateCommission("u1", "2026-04");
    expect(r!.snapshot.base_calculo).toBe(50000);
    expect(r!.snapshot.valor_variavel).toBe(1500);
    expect(r!.items[1].tipo).toBe("carteira_coord_agencia");
  });
});

describe("calculateCommission — Audiovisual Chefe (mesma fórmula de Coordenador)", () => {
  it("calcula 2% sobre carteira agência", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return mockProfile({ id: "u1", role: "audiovisual_chefe", fixo_mensal: 5000, comissao_percent: 2, comissao_primeiro_mes_percent: 0 });
      }
      if (table === "clients") {
        return mockClientsAllAtivos([{ valor_mensal: 50000 }]);
      }
      return {};
    });
    const r = await calculateCommission("u1", "2026-04");
    expect(r!.snapshot.valor_variavel).toBe(1000);
    expect(r!.items[1].tipo).toBe("carteira_coord_agencia");
  });
});

describe("calculateCommission — Comercial", () => {
  it("calcula 25% sobre 1º mês de cada deal fechado no mês", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return mockProfile({ id: "u1", role: "comercial", fixo_mensal: 4000, comissao_percent: 0, comissao_primeiro_mes_percent: 25 });
      }
      if (table === "leads") {
        return mockLeadsQuery([
          { id: "l1", valor_proposto: 4500, client_id: "c1", cliente: { nome: "Pizzaria Bella" } },
          { id: "l2", valor_proposto: 6200, client_id: "c2", cliente: { nome: "Restaurante Sabor" } },
        ]);
      }
      return {};
    });
    const r = await calculateCommission("u1", "2026-04");
    expect(r!.snapshot.valor_variavel).toBe(2675);
    expect(r!.items.length).toBe(3);
    expect(r!.items[1].tipo).toBe("deal_fechado_comercial");
    expect(r!.items[1].valor).toBe(1125);
    expect(r!.items[2].valor).toBe(1550);
  });

  it("comercial sem deals: variável = 0, items = só fixo", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return mockProfile({ id: "u1", role: "comercial", fixo_mensal: 4000, comissao_percent: 0, comissao_primeiro_mes_percent: 25 });
      }
      if (table === "leads") {
        return mockLeadsQuery([]);
      }
      return {};
    });
    const r = await calculateCommission("u1", "2026-04");
    expect(r!.snapshot.valor_variavel).toBe(0);
    expect(r!.items.length).toBe(1);
    expect(r!.items[0].tipo).toBe("fixo");
  });
});

describe("calculateCommission — ADM e Produtores", () => {
  it("ADM: só fixo, 1 item", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return mockProfile({ id: "u1", role: "adm", fixo_mensal: 6000, comissao_percent: 0, comissao_primeiro_mes_percent: 0 });
      }
      return {};
    });
    const r = await calculateCommission("u1", "2026-04");
    expect(r!.snapshot.fixo).toBe(6000);
    expect(r!.snapshot.valor_variavel).toBe(0);
    expect(r!.items.length).toBe(1);
    expect(r!.items[0].tipo).toBe("fixo");
  });

  it("Videomaker: só fixo, 1 item", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return mockProfile({ id: "u1", role: "videomaker", fixo_mensal: 3000, comissao_percent: 0, comissao_primeiro_mes_percent: 0 });
      }
      return {};
    });
    const r = await calculateCommission("u1", "2026-04");
    expect(r!.snapshot.valor_variavel).toBe(0);
    expect(r!.items.length).toBe(1);
  });
});

describe("calculateCommission — Sócio retorna null", () => {
  it("não gera snapshot pra sócio", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return mockProfile({ id: "u1", role: "socio", fixo_mensal: 0, comissao_percent: 0, comissao_primeiro_mes_percent: 0 });
      }
      return {};
    });
    const r = await calculateCommission("u1", "2026-04");
    expect(r).toBeNull();
  });
});
