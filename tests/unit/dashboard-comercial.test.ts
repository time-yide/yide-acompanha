import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromMock }),
}));

import {
  getLeadsKpis,
  getFunnelData,
  getProximasReunioes,
  getMetaComercial,
} from "@/lib/dashboard/comercial-queries";

beforeEach(() => {
  fromMock.mockReset();
});

describe("getLeadsKpis", () => {
  it("calcula leadsAtivos, fechamentosMes, ticketMedio, taxaConversao", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "leads") {
        return {
          select: () => ({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: "l1", stage: "prospeccao", valor_proposto: 30000, data_fechamento: null, motivo_perdido: null, created_at: "2026-04-01" },
                { id: "l2", stage: "comercial", valor_proposto: 50000, data_fechamento: null, motivo_perdido: null, created_at: "2026-03-15" },
                { id: "l3", stage: "ativo", valor_proposto: 40000, data_fechamento: "2026-04-10", motivo_perdido: null, created_at: "2026-02-01" },
                { id: "l4", stage: "ativo", valor_proposto: 60000, data_fechamento: "2026-04-25", motivo_perdido: null, created_at: "2026-02-15" },
                { id: "l5", stage: "comercial", valor_proposto: 20000, data_fechamento: null, motivo_perdido: "perdeu pra concorrente", created_at: "2026-04-05" },
              ],
            }),
          }),
        };
      }
      return {};
    });

    const r = await getLeadsKpis("u1", new Date(Date.UTC(2026, 3, 28)));
    // Ativos = não-ativos sem motivo_perdido = l1, l2 (l5 tem motivo_perdido)
    expect(r.leadsAtivos).toBe(2);
    // Fechamentos do mês de abril 2026 = l3, l4
    expect(r.fechamentosMes).toBe(2);
    // Ticket médio dos fechados nos últimos 90 dias = (40000 + 60000) / 2
    expect(r.ticketMedio).toBe(50000);
    // Taxa conversão últimos 90d = fechados / criados = 2 / 5 × 100 = 40
    expect(r.taxaConversao).toBeCloseTo(40);
  });

  it("retorna zeros quando comercial sem leads", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "leads") {
        return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [] }) }) };
      }
      return {};
    });

    const r = await getLeadsKpis("u1", new Date(Date.UTC(2026, 3, 28)));
    expect(r.leadsAtivos).toBe(0);
    expect(r.fechamentosMes).toBe(0);
    expect(r.ticketMedio).toBe(0);
    expect(r.taxaConversao).toBe(0);
  });
});

describe("getFunnelData", () => {
  it("retorna sempre 5 entries (uma por stage), mesmo quando vazias", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "leads") {
        return {
          select: () => ({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: "l1", stage: "prospeccao", valor_proposto: 10000 },
                { id: "l2", stage: "prospeccao", valor_proposto: 20000 },
                { id: "l3", stage: "ativo", valor_proposto: 50000 },
              ],
            }),
          }),
        };
      }
      return {};
    });

    const data = await getFunnelData("u1");
    expect(data).toHaveLength(5);
    expect(data.map((d) => d.stage)).toEqual(["prospeccao", "comercial", "contrato", "marco_zero", "ativo"]);
    expect(data[0].count).toBe(2);  // prospeccao
    expect(data[0].totalValor).toBe(30000);
    expect(data[1].count).toBe(0);  // comercial
    expect(data[4].count).toBe(1);  // ativo
  });
});

describe("getProximasReunioes", () => {
  it("une as 2 datas e ordena por data ascendente", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "leads") {
        return {
          select: () => ({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: "l1", nome_prospect: "A", data_prospeccao_agendada: "2026-04-30T10:00:00Z", data_reuniao_marco_zero: null },
                { id: "l2", nome_prospect: "B", data_prospeccao_agendada: null, data_reuniao_marco_zero: "2026-05-02T14:00:00Z" },
                { id: "l3", nome_prospect: "C", data_prospeccao_agendada: "2026-05-05T09:00:00Z", data_reuniao_marco_zero: "2026-04-29T16:00:00Z" },
              ],
            }),
          }),
        };
      }
      return {};
    });

    const r = await getProximasReunioes("u1", 14, new Date(Date.UTC(2026, 3, 28)));
    expect(r.length).toBeGreaterThanOrEqual(3);
    // Primeira reunião: l3 marco_zero (29-abr)
    expect(r[0].leadId).toBe("l3");
    expect(r[0].tipo).toBe("marco_zero");
    // Última (dentro do limite 14d): ordem cronológica
    expect(r[r.length - 1].data >= r[0].data).toBe(true);
  });

  it("ignora datas no passado", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "leads") {
        return {
          select: () => ({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: "l1", nome_prospect: "A", data_prospeccao_agendada: "2026-04-15T10:00:00Z", data_reuniao_marco_zero: null }, // passado
              ],
            }),
          }),
        };
      }
      return {};
    });

    const r = await getProximasReunioes("u1", 14, new Date(Date.UTC(2026, 3, 28)));
    expect(r).toEqual([]);
  });
});

describe("getMetaComercial", () => {
  it("calcula meta = (3 × fixo) / (percentual / 100)", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { fixo_mensal: 3000, comissao_percent: 10, comissao_primeiro_mes_percent: 10 },
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
                      { id: "l1", valor_proposto: 25000, data_fechamento: "2026-04-10" },
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

    const r = await getMetaComercial("u1", new Date(Date.UTC(2026, 3, 28)));
    // Meta comissão = 3 × 3000 = 9000
    // Meta fechamento = 9000 / 0.10 = 90000
    expect(r.metaComissao).toBe(9000);
    expect(r.metaFechamento).toBe(90000);
    // Fechado: 25000
    expect(r.fechadoMes).toBe(25000);
    // Comissão atual: 25000 × 10% = 2500
    expect(r.comissaoAtual).toBe(2500);
    // pctMeta: 25000 / 90000 × 100 = 27.78
    expect(r.pctMeta).toBeCloseTo(27.78, 1);
    // status: < 30 = "abaixo"
    expect(r.status).toBe("abaixo");
  });

  it("retorna metaFechamento = 0 quando comissao_percent é 0 (proteção div/zero)", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { fixo_mensal: 3000, comissao_percent: 0, comissao_primeiro_mes_percent: 0 },
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
                gte: () => ({ lte: vi.fn().mockResolvedValue({ data: [] }) }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const r = await getMetaComercial("u1", new Date(Date.UTC(2026, 3, 28)));
    expect(r.metaFechamento).toBe(0);
    expect(r.metaComissao).toBe(9000);
    expect(r.pctMeta).toBe(0);
    expect(r.status).toBe("abaixo");
  });

  it("status é 'atingido' quando pctMeta >= 100", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { fixo_mensal: 3000, comissao_percent: 10, comissao_primeiro_mes_percent: 10 },
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
                    data: [{ id: "l1", valor_proposto: 100000, data_fechamento: "2026-04-10" }],
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const r = await getMetaComercial("u1", new Date(Date.UTC(2026, 3, 28)));
    expect(r.pctMeta).toBeGreaterThanOrEqual(100);
    expect(r.status).toBe("atingido");
  });
});
