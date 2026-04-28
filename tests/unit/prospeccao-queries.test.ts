import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromMock }),
}));

import { getProspectsList, getProspectDetail, getLeadAttempts, getHistoricoFechamentos } from "@/lib/prospeccao/queries";

beforeEach(() => {
  fromMock.mockReset();
});

describe("getProspectsList", () => {
  it("filtra por comercialId quando passado", async () => {
    const eqMock = vi.fn().mockResolvedValue({
      data: [
        { id: "l1", nome_prospect: "Empresa A", site: null, contato_principal: null, stage: "prospeccao", valor_proposto: 5000, comercial_id: "u1", motivo_perdido: null, data_fechamento: null, prioridade: "media", created_at: "2026-04-01", comercial: { nome: "Carla" }, ultimo_attempt_at: null },
      ],
    });
    fromMock.mockImplementation((table) => {
      if (table === "leads") {
        return { select: () => ({ eq: eqMock }) };
      }
      return {};
    });

    const r = await getProspectsList({ comercialId: "u1" });
    expect(r).toHaveLength(1);
    expect(r[0].nome_prospect).toBe("Empresa A");
  });

  it("retorna lista vazia quando sem leads", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "leads") {
        return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [] }) }) };
      }
      return {};
    });

    const r = await getProspectsList({ comercialId: "u1" });
    expect(r).toEqual([]);
  });

  it("inclui filtro 'perdido' (motivo_perdido != null)", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "leads") {
        return {
          select: () => ({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: "l1", nome_prospect: "A", site: null, contato_principal: null, stage: "comercial", valor_proposto: 5000, comercial_id: "u1", motivo_perdido: "perdeu", data_fechamento: null, prioridade: "media", created_at: "2026-04-01", comercial: null, ultimo_attempt_at: null },
                { id: "l2", nome_prospect: "B", site: null, contato_principal: null, stage: "comercial", valor_proposto: 3000, comercial_id: "u1", motivo_perdido: null, data_fechamento: null, prioridade: "media", created_at: "2026-04-02", comercial: null, ultimo_attempt_at: null },
              ],
            }),
          }),
        };
      }
      return {};
    });

    const ativos = await getProspectsList({ comercialId: "u1", status: ["comercial"] });
    expect(ativos).toHaveLength(1);
    expect(ativos[0].id).toBe("l2");

    const perdidos = await getProspectsList({ comercialId: "u1", status: ["perdido"] });
    expect(perdidos).toHaveLength(1);
    expect(perdidos[0].id).toBe("l1");
  });

  it("aplica filtro de valor_min/valor_max em memória", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "leads") {
        return {
          select: () => ({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: "l1", nome_prospect: "A", site: null, contato_principal: null, stage: "comercial", valor_proposto: 1000, comercial_id: "u1", motivo_perdido: null, data_fechamento: null, prioridade: "media", created_at: "2026-04-01", comercial: null, ultimo_attempt_at: null },
                { id: "l2", nome_prospect: "B", site: null, contato_principal: null, stage: "comercial", valor_proposto: 5000, comercial_id: "u1", motivo_perdido: null, data_fechamento: null, prioridade: "media", created_at: "2026-04-02", comercial: null, ultimo_attempt_at: null },
                { id: "l3", nome_prospect: "C", site: null, contato_principal: null, stage: "comercial", valor_proposto: 10000, comercial_id: "u1", motivo_perdido: null, data_fechamento: null, prioridade: "media", created_at: "2026-04-03", comercial: null, ultimo_attempt_at: null },
              ],
            }),
          }),
        };
      }
      return {};
    });

    const r = await getProspectsList({ comercialId: "u1", valorMin: 3000, valorMax: 7000 });
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("l2");
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
