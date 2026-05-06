import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromMock }),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

// unstable_cache: executa o callback direto (sem cache no ambiente de teste)
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { getProspectsList, getProspectDetail, getLeadAttempts, getHistoricoFechamentos, getMetasComercial } from "@/lib/prospeccao/queries";

beforeEach(() => {
  fromMock.mockReset();
});

/**
 * Helper: cria um mock encadeável de query builder Supabase.
 * Cada método retorna o próprio objeto, e o objeto é "thenable" (resolve com o data fornecido).
 */
function chainableMock<T>(data: T) {
  const result = { data };
  // Conjunto de métodos usados no fluxo de getProspectsList + outras queries
  const methods = ["select", "eq", "neq", "in", "is", "not", "or", "gte", "lte", "order"];
  const obj: Record<string, unknown> = {
    then: (resolve: (v: typeof result) => void) => resolve(result),
  };
  for (const m of methods) {
    obj[m] = vi.fn(() => obj);
  }
  return obj;
}

describe("getProspectsList", () => {
  it("filtra por comercialId quando passado (query usa .eq comercial_id)", async () => {
    const leadsChain = chainableMock([
      { id: "l1", nome_prospect: "Empresa A", site: null, contato_principal: null, stage: "prospeccao", valor_proposto: 5000, comercial_id: "u1", motivo_perdido: null, data_fechamento: null, prioridade: "media", created_at: "2026-04-01", comercial: { nome: "Carla" }, ultimo_attempt_at: null },
    ]);
    fromMock.mockImplementation((table) => (table === "leads" ? leadsChain : {}));

    const r = await getProspectsList({ comercialId: "u1" });
    expect(r).toHaveLength(1);
    expect(r[0].nome_prospect).toBe("Empresa A");
    expect(leadsChain.eq).toHaveBeenCalledWith("comercial_id", "u1");
  });

  it("retorna lista vazia quando sem leads", async () => {
    fromMock.mockImplementation((table) => (table === "leads" ? chainableMock([]) : {}));
    const r = await getProspectsList({ comercialId: "u1" });
    expect(r).toEqual([]);
  });

  it("filtro 'perdido' (apenas) usa .not motivo_perdido is null", async () => {
    const leadsChain = chainableMock([
      { id: "l1", nome_prospect: "A", site: null, contato_principal: null, stage: "comercial", valor_proposto: 5000, comercial_id: "u1", motivo_perdido: "perdeu", data_fechamento: null, prioridade: "media", created_at: "2026-04-01", comercial: null, ultimo_attempt_at: null },
    ]);
    fromMock.mockImplementation((table) => (table === "leads" ? leadsChain : {}));

    const r = await getProspectsList({ comercialId: "u1", status: ["perdido"] });
    expect(r).toHaveLength(1);
    expect(leadsChain.not).toHaveBeenCalledWith("motivo_perdido", "is", null);
  });

  it("filtro só de status reais usa .in stage + .is motivo_perdido null", async () => {
    const leadsChain = chainableMock([
      { id: "l2", nome_prospect: "B", site: null, contato_principal: null, stage: "comercial", valor_proposto: 3000, comercial_id: "u1", motivo_perdido: null, data_fechamento: null, prioridade: "media", created_at: "2026-04-02", comercial: null, ultimo_attempt_at: null },
    ]);
    fromMock.mockImplementation((table) => (table === "leads" ? leadsChain : {}));

    const r = await getProspectsList({ comercialId: "u1", status: ["comercial"] });
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("l2");
    expect(leadsChain.in).toHaveBeenCalledWith("stage", ["comercial"]);
    expect(leadsChain.is).toHaveBeenCalledWith("motivo_perdido", null);
  });

  it("filtro misto (perdido + status reais) usa .or", async () => {
    const leadsChain = chainableMock([]);
    fromMock.mockImplementation((table) => (table === "leads" ? leadsChain : {}));

    await getProspectsList({ comercialId: "u1", status: ["perdido", "comercial"] });
    expect(leadsChain.or).toHaveBeenCalledWith(
      "motivo_perdido.not.is.null,and(stage.in.(comercial),motivo_perdido.is.null)",
    );
  });

  it("aplica .gte/.lte pra valor_proposto", async () => {
    const leadsChain = chainableMock([]);
    fromMock.mockImplementation((table) => (table === "leads" ? leadsChain : {}));

    await getProspectsList({ comercialId: "u1", valorMin: 3000, valorMax: 7000 });
    expect(leadsChain.gte).toHaveBeenCalledWith("valor_proposto", 3000);
    expect(leadsChain.lte).toHaveBeenCalledWith("valor_proposto", 7000);
  });
});

describe("getProspectDetail", () => {
  it("retorna o lead com dados do comercial", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "leads") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "l1",
                  nome_prospect: "Empresa A",
                  site: "https://a.com",
                  contato_principal: "Maria",
                  email: "maria@a.com",
                  telefone: "11999999999",
                  stage: "prospeccao",
                  valor_proposto: 5000,
                  comercial_id: "u1",
                  motivo_perdido: null,
                  data_fechamento: null,
                  data_prospeccao_agendada: null,
                  data_reuniao_marco_zero: null,
                  duracao_meses: 12,
                  servico_proposto: "Social media",
                  prioridade: "alta",
                  info_briefing: "Cliente quer pacote completo",
                  client_id: null,
                  created_at: "2026-04-01",
                  updated_at: "2026-04-01",
                  comercial: { nome: "Carla", email: "carla@y.com" },
                },
              }),
            }),
          }),
        };
      }
      return {};
    });

    const r = await getProspectDetail("l1");
    expect(r).not.toBeNull();
    expect(r!.nome_prospect).toBe("Empresa A");
    expect(r!.comercial?.nome).toBe("Carla");
  });

  it("retorna null quando lead não existe", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "leads") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
        };
      }
      return {};
    });

    const r = await getProspectDetail("nonexistent");
    expect(r).toBeNull();
  });
});

describe("getLeadAttempts", () => {
  it("retorna attempts ordenados por created_at desc", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "lead_attempts") {
        return {
          select: () => ({
            eq: () => ({
              order: vi.fn().mockResolvedValue({
                data: [
                  { id: "a2", lead_id: "l1", canal: "email", resultado: "sem_resposta", observacao: "Email enviado", proximo_passo: "Ligar amanhã", data_proximo_passo: "2026-04-15", created_at: "2026-04-10T10:00:00Z", autor_id: "u1", autor: { nome: "Carla" } },
                  { id: "a1", lead_id: "l1", canal: "whatsapp", resultado: "agendou", observacao: null, proximo_passo: null, data_proximo_passo: null, created_at: "2026-04-08T14:00:00Z", autor_id: "u1", autor: { nome: "Carla" } },
                ],
              }),
            }),
          }),
        };
      }
      return {};
    });

    const r = await getLeadAttempts("l1");
    expect(r).toHaveLength(2);
    expect(r[0].id).toBe("a2");
  });

  it("retorna lista vazia quando sem attempts", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "lead_attempts") {
        return {
          select: () => ({
            eq: () => ({
              order: vi.fn().mockResolvedValue({ data: [] }),
            }),
          }),
        };
      }
      return {};
    });

    const r = await getLeadAttempts("l1");
    expect(r).toEqual([]);
  });
});

describe("getHistoricoFechamentos", () => {
  it("une leads fechados com clients e commission_snapshots", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "leads") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gte: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "l1",
                      client_id: "c1",
                      data_fechamento: "2026-03-15",
                      cliente: { id: "c1", nome: "Cliente A", valor_mensal: 5000 },
                    },
                    {
                      id: "l2",
                      client_id: "c2",
                      data_fechamento: "2026-04-10",
                      cliente: { id: "c2", nome: "Cliente B", valor_mensal: 3000 },
                    },
                  ],
                }),
              }),
            }),
          }),
        };
      }
      if (table === "commission_snapshots") {
        return {
          select: () => ({
            eq: () => ({
              in: vi.fn().mockResolvedValue({
                data: [
                  { user_id: "u1", mes_referencia: "2026-03", valor_total: 800 },
                  { user_id: "u1", mes_referencia: "2026-04", valor_total: 1200 },
                ],
              }),
            }),
          }),
        };
      }
      return {};
    });

    const r = await getHistoricoFechamentos("u1", 12, new Date(Date.UTC(2026, 3, 28)));
    expect(r).toHaveLength(2);
    expect(r[0].clienteNome).toBe("Cliente B");  // ordenado por data desc
    expect(r[0].comissaoRecebida).toBe(1200);
    expect(r[1].comissaoRecebida).toBe(800);
  });

  it("retorna comissaoRecebida=0 quando snapshot não existe pra aquele mês", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "leads") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gte: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "l1",
                      client_id: "c1",
                      data_fechamento: "2026-04-10",
                      cliente: { id: "c1", nome: "Cliente A", valor_mensal: 5000 },
                    },
                  ],
                }),
              }),
            }),
          }),
        };
      }
      if (table === "commission_snapshots") {
        return {
          select: () => ({
            eq: () => ({
              in: vi.fn().mockResolvedValue({ data: [] }),
            }),
          }),
        };
      }
      return {};
    });

    const r = await getHistoricoFechamentos("u1", 12, new Date(Date.UTC(2026, 3, 28)));
    expect(r).toHaveLength(1);
    expect(r[0].comissaoRecebida).toBe(0);
  });
});

describe("getMetasComercial", () => {
  it("usa metas configuradas quando não-null", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  fixo_mensal: 3000,
                  comissao_percent: 10,
                  meta_prospects_mes: 30,
                  meta_fechamentos_mes: 5,
                  meta_receita_mes: 100000,
                },
              }),
            }),
          }),
        };
      }
      if (table === "leads") {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lte: vi.fn().mockResolvedValue({
                  data: [
                    { id: "l1", stage: "comercial", valor_proposto: 30000, data_fechamento: null, created_at: "2026-04-05" },
                    { id: "l2", stage: "ativo", valor_proposto: 50000, data_fechamento: "2026-04-15", created_at: "2026-04-01" },
                  ],
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const r = await getMetasComercial("u1", new Date(Date.UTC(2026, 3, 28)));
    expect(r.prospects.realizado).toBe(2);
    expect(r.prospects.meta).toBe(30);
    expect(r.prospects.configurada).toBe(true);
    expect(r.fechamentos.realizado).toBe(1);
    expect(r.fechamentos.meta).toBe(5);
    expect(r.receita.realizado).toBe(50000);
    expect(r.receita.meta).toBe(100000);
  });

  it("usa fallback automático quando metas são null", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  fixo_mensal: 3000,
                  comissao_percent: 10,
                  meta_prospects_mes: null,
                  meta_fechamentos_mes: null,
                  meta_receita_mes: null,
                },
              }),
            }),
          }),
        };
      }
      if (table === "leads") {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({ lte: vi.fn().mockResolvedValue({ data: [] }) }),
            }),
          }),
        };
      }
      return {};
    });

    const r = await getMetasComercial("u1", new Date(Date.UTC(2026, 3, 28)));
    expect(r.prospects.meta).toBe(20);
    expect(r.prospects.configurada).toBe(false);
    expect(r.fechamentos.meta).toBe(3);
    expect(r.fechamentos.configurada).toBe(false);
    expect(r.receita.meta).toBe(90000);
    expect(r.receita.configurada).toBe(false);
  });

  it("calcula pctMeta e status corretamente", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  fixo_mensal: 3000,
                  comissao_percent: 10,
                  meta_prospects_mes: 10,
                  meta_fechamentos_mes: 5,
                  meta_receita_mes: 50000,
                },
              }),
            }),
          }),
        };
      }
      if (table === "leads") {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lte: vi.fn().mockResolvedValue({
                  data: [
                    { id: "l1", stage: "prospeccao", valor_proposto: 10000, data_fechamento: null, created_at: "2026-04-01" },
                    { id: "l2", stage: "prospeccao", valor_proposto: 10000, data_fechamento: null, created_at: "2026-04-02" },
                    { id: "l3", stage: "prospeccao", valor_proposto: 10000, data_fechamento: null, created_at: "2026-04-03" },
                    { id: "l4", stage: "prospeccao", valor_proposto: 10000, data_fechamento: null, created_at: "2026-04-04" },
                    { id: "l5", stage: "prospeccao", valor_proposto: 10000, data_fechamento: null, created_at: "2026-04-05" },
                    { id: "l6", stage: "prospeccao", valor_proposto: 10000, data_fechamento: null, created_at: "2026-04-06" },
                    { id: "l7", stage: "prospeccao", valor_proposto: 10000, data_fechamento: null, created_at: "2026-04-07" },
                    { id: "l8", stage: "prospeccao", valor_proposto: 10000, data_fechamento: null, created_at: "2026-04-08" },
                    { id: "l9", stage: "ativo", valor_proposto: 60000, data_fechamento: "2026-04-15", created_at: "2026-04-01" },
                  ],
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const r = await getMetasComercial("u1", new Date(Date.UTC(2026, 3, 28)));
    expect(r.prospects.pctMeta).toBeCloseTo(90);
    expect(r.prospects.status).toBe("perto");
    expect(r.fechamentos.status).toBe("abaixo");
    expect(r.receita.status).toBe("atingido");
  });

  it("status 'no-caminho' quando 30 <= pctMeta < 80", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  fixo_mensal: 3000,
                  comissao_percent: 10,
                  meta_prospects_mes: 10,
                  meta_fechamentos_mes: 10,
                  meta_receita_mes: 100000,
                },
              }),
            }),
          }),
        };
      }
      if (table === "leads") {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lte: vi.fn().mockResolvedValue({
                  data: [
                    { id: "l1", stage: "prospeccao", valor_proposto: 10000, data_fechamento: null, created_at: "2026-04-01" },
                    { id: "l2", stage: "prospeccao", valor_proposto: 10000, data_fechamento: null, created_at: "2026-04-02" },
                    { id: "l3", stage: "prospeccao", valor_proposto: 10000, data_fechamento: null, created_at: "2026-04-03" },
                    { id: "l4", stage: "prospeccao", valor_proposto: 10000, data_fechamento: null, created_at: "2026-04-04" },
                    { id: "l5", stage: "prospeccao", valor_proposto: 10000, data_fechamento: null, created_at: "2026-04-05" },
                  ],
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const r = await getMetasComercial("u1", new Date(Date.UTC(2026, 3, 28)));
    expect(r.prospects.status).toBe("no-caminho");
  });
});
