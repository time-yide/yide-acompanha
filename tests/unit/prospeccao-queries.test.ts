import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromMock }),
}));

import { getProspectsList } from "@/lib/prospeccao/queries";

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
