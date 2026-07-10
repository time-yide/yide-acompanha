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

/** Cria um mock que suporta N chamadas encadeadas de .eq()/.is() antes de resolver. */
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

/** Mock de clientes para assessor: select().eq(assessor_id).eq(status).eq(tipo_relacao) → data */
function mockClientsQuery(rows: Array<{ valor_mensal: number; nome?: string; id?: string; tipo_relacao?: string }>) {
  return ({
    select: () => makeChainableEqMock(rows),
  });
}

/** Mock de ajuste mensal: select().in().eq() → data: [] */
function mockAdjustmentsEmpty() {
  return ({
    select: () => ({
      in: () => ({
        eq: vi.fn().mockResolvedValue({ data: [] }),
      }),
    }),
  });
}

function mockClientsAllAtivos(rows: Array<{ valor_mensal: number; nome?: string; id?: string; tipo_relacao?: string }>) {
  return ({
    select: () => makeChainableEqMock(rows),
  });
}

function mockLeadsQuery(rows: Array<{ id: string; valor_proposto: number; client_id: string | null; cliente: { nome: string } | null }>) {
  // Chain: select().eq(comercial_id).is(deleted_at, null).gte(data_fechamento).lte(data_fechamento)
  return ({
    select: () => ({
      eq: () => ({
        is: () => ({
          gte: () => ({
            lte: vi.fn().mockResolvedValue({ data: rows }),
          }),
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
        return mockClientsQuery([{ valor_mensal: 6000, nome: "A", id: "c1", tipo_relacao: "comum" }, { valor_mensal: 4000, nome: "B", id: "c2", tipo_relacao: "comum" }]);
      }
      if (table === "client_monthly_adjustments") {
        return mockAdjustmentsEmpty();
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

describe("calculateCommission — Coordenador legado (só fixo)", () => {
  // Decisão Yasmin (PR #258): o role `coordenador` foi descontinuado.
  // Perfis remanescentes caem no fallback de só-fixo (sem variável).
  it("coordenador legado: só fixo, sem parte variável sobre carteira", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return mockProfile({ id: "u1", role: "coordenador", fixo_mensal: 5000, comissao_percent: 3, comissao_primeiro_mes_percent: 0 });
      }
      return {};
    });
    const r = await calculateCommission("u1", "2026-04");
    expect(r).not.toBeNull();
    expect(r!.snapshot.fixo).toBe(5000);
    expect(r!.snapshot.base_calculo).toBe(0);
    expect(r!.snapshot.valor_variavel).toBe(0);
    expect(r!.snapshot.percentual_aplicado).toBe(0);
    expect(r!.items.length).toBe(1);
    expect(r!.items[0].tipo).toBe("fixo");
  });
});

describe("calculateCommission — Audiovisual Chefe (mesma fórmula de Coordenador)", () => {
  it("calcula 2% sobre carteira agência", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return mockProfile({ id: "u1", role: "audiovisual_chefe", fixo_mensal: 5000, comissao_percent: 2, comissao_primeiro_mes_percent: 0 });
      }
      if (table === "clients") {
        return mockClientsAllAtivos([{ valor_mensal: 50000, id: "c1", tipo_relacao: "comum" }]);
      }
      if (table === "client_monthly_adjustments") {
        return mockAdjustmentsEmpty();
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

  it("Assistente de e-commerce: só fixo, IGNORA comissao_percent (não ganha %)", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        // comissao_percent=10 de propósito: o cálculo deve ignorar pra esse role.
        return mockProfile({ id: "u1", role: "assistente_ecommerce", fixo_mensal: 2500, comissao_percent: 10, comissao_primeiro_mes_percent: 10 });
      }
      return {};
    });
    const r = await calculateCommission("u1", "2026-04");
    expect(r!.snapshot.fixo).toBe(2500);
    expect(r!.snapshot.valor_variavel).toBe(0);
    expect(r!.snapshot.percentual_aplicado).toBe(0);
    expect(r!.items.length).toBe(1);
  });

  it("Programação: só fixo, IGNORA comissao_percent (não ganha %)", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return mockProfile({ id: "u1", role: "programacao", fixo_mensal: 4000, comissao_percent: 10, comissao_primeiro_mes_percent: 10 });
      }
      return {};
    });
    const r = await calculateCommission("u1", "2026-04");
    expect(r!.snapshot.fixo).toBe(4000);
    expect(r!.snapshot.valor_variavel).toBe(0);
    expect(r!.snapshot.percentual_aplicado).toBe(0);
    expect(r!.items.length).toBe(1);
  });
});

describe("calculateCommission — Sócio (prolábore fixo, sem variável)", () => {
  // Decisão Yasmin (PR #258): sócio agora ganha prolábore fixo (sugestão
  // R$ 15.000 setado em `profiles.fixo_mensal`). Antes retornava null — era
  // invisível no calculator. UI mostra como "Coordenador".
  it("sócio: gera snapshot com prolábore fixo, sem parte variável", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return mockProfile({ id: "u1", role: "socio", fixo_mensal: 15000, comissao_percent: 0, comissao_primeiro_mes_percent: 0 });
      }
      return {};
    });
    const r = await calculateCommission("u1", "2026-04");
    expect(r).not.toBeNull();
    expect(r!.snapshot.fixo).toBe(15000);
    expect(r!.snapshot.base_calculo).toBe(0);
    expect(r!.snapshot.valor_variavel).toBe(0);
    expect(r!.snapshot.percentual_aplicado).toBe(0);
    expect(r!.items.length).toBe(1);
    expect(r!.items[0].tipo).toBe("fixo");
    expect(r!.items[0].descricao).toBe("Prolábore");
    expect(r!.items[0].valor).toBe(15000);
  });
});
