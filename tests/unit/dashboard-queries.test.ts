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

/** Cria um objeto que suporta N chamadas encadeadas de .eq() e se resolve como Promise com { data }. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeChainableQuery(data: unknown[]): any {
  const resolved = Promise.resolve({ data });
  const chainable = {
    eq: vi.fn(),
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  chainable.eq.mockReturnValue(chainable);
  return chainable;
}

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

// unstable_cache: executa o callback diretamente (sem cache no ambiente de teste)
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import {
  _getKpisImpl,
  _getCarteiraTimelineImpl,
  _getEntradaChurnImpl,
  _getCarteiraPorAssessorImpl,
  _getRankingSatisfacaoImpl,
  _getProximosEventosImpl,
  _getMesAguardandoAprovacaoImpl,
  getRankingSatisfacao,
  getProximosEventos,
  getMesAguardandoAprovacao,
  getCarteiraPorAssessor,
} from "@/lib/dashboard/queries";

beforeEach(() => {
  fromMock.mockReset();
});

describe("getKpis", () => {
  it("calcula carteira ativa e clientes ativos a partir de clients ativos", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 28)));

    fromMock.mockImplementation((table) => {
      if (table === "clients") {
        return {
          select: () => makeChainableQuery([
            { id: "c1", valor_mensal: 5000, data_entrada: "2025-01-01", data_churn: null, status: "ativo", tipo_relacao: "comum" },
            { id: "c2", valor_mensal: 3000, data_entrada: "2025-06-01", data_churn: null, status: "ativo", tipo_relacao: "comum" },
            { id: "c3", valor_mensal: 4000, data_entrada: "2024-08-01", data_churn: "2026-04-15", status: "ativo", tipo_relacao: "comum" },
          ]),
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

    const r = await _getKpisImpl();
    // c1 e c2 são ativos sem churn; c3 churnou em abril (ainda no mês de referência)
    // Carteira ativa hoje (28/abr/2026): c1 + c2 = 8000 (c3 churnou em 15/abr, não está mais ativo)
    expect(r.carteiraAtiva.valor).toBe(8000);
    expect(r.clientesAtivos.quantidade).toBe(2);
    expect(r.churnMes.quantidade).toBe(1);    // c3 churnou em abril
    expect(r.churnMes.valorPerdido).toBe(4000);
    // Custo de comissão: 800 / 8000 = 10%
    expect(r.custoComissaoPct.pct).toBeCloseTo(10);

    vi.useRealTimers();
  });

  it("retorna zeros quando não há clientes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 28)));

    fromMock.mockImplementation((table) => {
      if (table === "clients") {
        return { select: () => makeChainableQuery([]) };
      }
      if (table === "commission_snapshots") {
        return { select: () => ({ order: () => ({ limit: vi.fn().mockResolvedValue({ data: [] }) }) }) };
      }
      return {};
    });

    const r = await _getKpisImpl();
    expect(r.carteiraAtiva.valor).toBe(0);
    expect(r.clientesAtivos.quantidade).toBe(0);
    expect(r.churnMes.quantidade).toBe(0);
    expect(r.custoComissaoPct.pct).toBe(0);

    vi.useRealTimers();
  });
});

describe("getCarteiraTimeline", () => {
  it("calcula carteira mes a mes considerando entrada e churn", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 28)));

    fromMock.mockImplementation((table) => {
      if (table === "clients") {
        return {
          select: () => makeChainableQuery([
            // Cliente ativo de 01/2026 em diante
            { id: "c1", valor_mensal: 5000, data_entrada: "2026-01-15", data_churn: null },
            // Cliente ativo de 02/2026 a 03/2026 (churnou em 03)
            { id: "c2", valor_mensal: 3000, data_entrada: "2026-02-01", data_churn: "2026-03-20" },
          ]),
        };
      }
      return {};
    });

    const timeline = await _getCarteiraTimelineImpl(4);
    expect(timeline).toHaveLength(4);
    expect(timeline.map((p) => p.mes)).toEqual(["2026-01", "2026-02", "2026-03", "2026-04"]);
    // Janeiro: só c1 ativo no fim de janeiro
    expect(timeline[0].valorTotal).toBe(5000);
    // Fevereiro: c1 + c2 ativos
    expect(timeline[1].valorTotal).toBe(8000);
    // Março: c1 ativo, c2 churnou em 20/03 → no fim de março não estava ativo
    expect(timeline[2].valorTotal).toBe(5000);
    // Abril: só c1
    expect(timeline[3].valorTotal).toBe(5000);

    vi.useRealTimers();
  });

  it("retorna 0 em meses sem clientes ativos", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 28)));

    fromMock.mockImplementation(() => ({
      select: () => makeChainableQuery([]),
    }));
    const timeline = await _getCarteiraTimelineImpl(3);
    expect(timeline).toHaveLength(3);
    expect(timeline.every((p) => p.valorTotal === 0)).toBe(true);

    vi.useRealTimers();
  });
});

describe("getEntradaChurn", () => {
  it("conta entradas e churns por mes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 28)));

    fromMock.mockImplementation(() => ({
      select: () => makeChainableQuery([
        { id: "c1", data_entrada: "2026-02-15", data_churn: null },
        { id: "c2", data_entrada: "2026-02-20", data_churn: null },
        { id: "c3", data_entrada: "2026-03-05", data_churn: null },
        { id: "c4", data_entrada: "2025-08-01", data_churn: "2026-03-10" },
        { id: "c5", data_entrada: "2025-09-01", data_churn: "2026-04-15" },
      ]),
    }));

    const data = await _getEntradaChurnImpl(3);
    expect(data).toHaveLength(3);
    expect(data.map((p) => p.mes)).toEqual(["2026-02", "2026-03", "2026-04"]);
    expect(data[0]).toEqual({ mes: "2026-02", entradas: 2, churns: 0 });
    expect(data[1]).toEqual({ mes: "2026-03", entradas: 1, churns: 1 });
    expect(data[2]).toEqual({ mes: "2026-04", entradas: 0, churns: 1 });

    vi.useRealTimers();
  });

  it("retorna zeros para meses sem dados", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 28)));

    fromMock.mockImplementation(() => ({
      select: () => makeChainableQuery([]),
    }));
    const data = await _getEntradaChurnImpl(2);
    expect(data).toEqual([
      { mes: "2026-03", entradas: 0, churns: 0 },
      { mes: "2026-04", entradas: 0, churns: 0 },
    ]);

    vi.useRealTimers();
  });
});

describe("getCarteiraPorAssessor", () => {
  it("agrupa por assessor e calcula percentuais", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "clients") {
        return {
          select: () => makeChainableQuery([
            { id: "c1", valor_mensal: 5000, assessor_id: "a1", assessor: { nome: "Ana" } },
            { id: "c2", valor_mensal: 3000, assessor_id: "a1", assessor: { nome: "Ana" } },
            { id: "c3", valor_mensal: 4000, assessor_id: "a2", assessor: { nome: "Bruno" } },
            // cliente sem assessor: ignorado
            { id: "c4", valor_mensal: 1000, assessor_id: null, assessor: null },
          ]),
        };
      }
      return {};
    });

    const list = await getCarteiraPorAssessor();
    expect(list).toHaveLength(2);
    // Ordenado por valorTotal desc: Ana (8000) > Bruno (4000)
    expect(list[0]).toEqual({
      assessorId: "a1",
      assessorNome: "Ana",
      qtdClientes: 2,
      valorTotal: 8000,
      pctDoTotal: expect.closeTo(66.67, 1),
    });
    expect(list[1]).toEqual({
      assessorId: "a2",
      assessorNome: "Bruno",
      qtdClientes: 1,
      valorTotal: 4000,
      pctDoTotal: expect.closeTo(33.33, 1),
    });
  });

  it("retorna lista vazia quando sem clientes", async () => {
    fromMock.mockImplementation(() => ({
      select: () => makeChainableQuery([]),
    }));
    const list = await getCarteiraPorAssessor();
    expect(list).toEqual([]);
  });
});

/** Mock do supabase para o ranking de satisfação live (entries + synthesis). */
function mockSatisfacaoRanking({
  clients,
  entries,
  synthesis,
}: {
  clients: Array<{ id: string; nome: string; assessor_id: string | null; coordenador_id: string | null }>;
  entries: Array<{ client_id: string; autor_id: string; papel_autor: string; cor: "verde" | "amarelo" | "vermelho" }>;
  synthesis: Array<{ id: string; client_id: string; score_final: number; cor_final: "verde" | "amarelo" | "vermelho"; resumo_ia: string; divergencia_detectada: boolean; acao_sugerida: string | null; created_at: string }>;
}) {
  fromMock.mockImplementation((table) => {
    if (table === "clients") {
      return { select: () => makeChainableQuery(clients) };
    }
    if (table === "satisfaction_entries") {
      // Cadeia: .select().eq().in().not() → resolve com { data: entries }
      const final = Promise.resolve({ data: entries });
      const chain = {
        eq: vi.fn(),
        in: vi.fn(),
        not: vi.fn(),
        then: final.then.bind(final),
        catch: final.catch.bind(final),
        finally: final.finally.bind(final),
      };
      chain.eq.mockReturnValue(chain);
      chain.in.mockReturnValue(chain);
      chain.not.mockReturnValue(chain);
      return { select: () => chain };
    }
    if (table === "satisfaction_synthesis") {
      // Cadeia: .select().eq().in() → resolve com { data: synthesis }
      const final = Promise.resolve({ data: synthesis });
      const chain = {
        eq: vi.fn(),
        in: vi.fn(),
        then: final.then.bind(final),
        catch: final.catch.bind(final),
        finally: final.finally.bind(final),
      };
      chain.eq.mockReturnValue(chain);
      chain.in.mockReturnValue(chain);
      return { select: () => chain };
    }
    return {};
  });
}

describe("getRankingSatisfacao", () => {
  it("ranqueia top (verde desc) e bottom (vermelho asc), usa síntese quando existe", async () => {
    mockSatisfacaoRanking({
      clients: [
        { id: "c1", nome: "Alpha", assessor_id: "a1", coordenador_id: "co1" },
        { id: "c2", nome: "Beta", assessor_id: "a1", coordenador_id: "co1" },
        { id: "c3", nome: "Gamma", assessor_id: "a1", coordenador_id: "co1" },
        { id: "c4", nome: "Delta", assessor_id: "a1", coordenador_id: "co1" },
        { id: "c5", nome: "Epsilon", assessor_id: "a1", coordenador_id: "co1" },
        { id: "c6", nome: "Zeta", assessor_id: "a1", coordenador_id: "co1" },
      ],
      entries: [
        { client_id: "c1", autor_id: "a1", papel_autor: "assessor", cor: "verde" },
        { client_id: "c2", autor_id: "a1", papel_autor: "assessor", cor: "verde" },
        { client_id: "c3", autor_id: "a1", papel_autor: "assessor", cor: "verde" },
        { client_id: "c4", autor_id: "a1", papel_autor: "assessor", cor: "vermelho" },
        { client_id: "c5", autor_id: "a1", papel_autor: "assessor", cor: "amarelo" },
        { client_id: "c6", autor_id: "a1", papel_autor: "assessor", cor: "vermelho" },
      ],
      synthesis: [
        { id: "s1", client_id: "c1", score_final: 9.5, cor_final: "verde", resumo_ia: "ok", divergencia_detectada: false, acao_sugerida: null, created_at: "2026-04-27" },
        { id: "s2", client_id: "c2", score_final: 8.5, cor_final: "verde", resumo_ia: "ok", divergencia_detectada: false, acao_sugerida: null, created_at: "2026-04-27" },
        { id: "s3", client_id: "c3", score_final: 9.0, cor_final: "verde", resumo_ia: "ok", divergencia_detectada: false, acao_sugerida: null, created_at: "2026-04-27" },
        { id: "s4", client_id: "c4", score_final: 2.0, cor_final: "vermelho", resumo_ia: "x", divergencia_detectada: false, acao_sugerida: "ação", created_at: "2026-04-27" },
        { id: "s5", client_id: "c5", score_final: 5.0, cor_final: "amarelo", resumo_ia: "x", divergencia_detectada: false, acao_sugerida: "ação", created_at: "2026-04-27" },
        { id: "s6", client_id: "c6", score_final: 3.5, cor_final: "vermelho", resumo_ia: "x", divergencia_detectada: false, acao_sugerida: "ação", created_at: "2026-04-27" },
      ],
    });

    const r = await getRankingSatisfacao();
    // Top: 3 verdes ordenados desc + amarelo (faltam 7 verdes pra completar 10)
    expect(r.top.map((s) => s.client_id)).toEqual(["c1", "c3", "c2", "c5"]);
    // Bottom: 2 vermelhos asc + amarelo (faltam 8 vermelhos pra completar 10)
    expect(r.bottom.map((s) => s.client_id)).toEqual(["c4", "c6", "c5"]);
  });

  it("inclui cliente no ranking mesmo sem síntese (live por entries)", async () => {
    mockSatisfacaoRanking({
      clients: [
        { id: "c1", nome: "Alpha", assessor_id: "a1", coordenador_id: "co1" },
      ],
      entries: [
        // Só assessor votou verde → score live = 10, status em_curso
        { client_id: "c1", autor_id: "a1", papel_autor: "assessor", cor: "verde" },
      ],
      synthesis: [],
    });

    const r = await getRankingSatisfacao();
    expect(r.top).toHaveLength(1);
    expect(r.top[0].client_id).toBe("c1");
    expect(r.top[0].score_final).toBe(10);
    expect(r.top[0].cor_final).toBe("verde");
    expect(r.top[0].status).toBe("em_curso");
    expect(r.top[0].votos_atuais).toBe(1);
    expect(r.top[0].votos_esperados).toBe(2); // assessor + coord
  });

  it("status 'completo' quando assessor + coord já votaram", async () => {
    mockSatisfacaoRanking({
      clients: [
        { id: "c1", nome: "Alpha", assessor_id: "a1", coordenador_id: "co1" },
      ],
      entries: [
        { client_id: "c1", autor_id: "a1", papel_autor: "assessor", cor: "verde" },
        { client_id: "c1", autor_id: "co1", papel_autor: "coordenador", cor: "amarelo" },
      ],
      synthesis: [],
    });

    const r = await getRankingSatisfacao();
    expect(r.top[0].status).toBe("completo");
    expect(r.top[0].votos_atuais).toBe(2);
  });

  it("retorna listas vazias quando não há clientes", async () => {
    mockSatisfacaoRanking({ clients: [], entries: [], synthesis: [] });
    const r = await getRankingSatisfacao();
    expect(r.top).toEqual([]);
    expect(r.bottom).toEqual([]);
  });

  it("retorna listas vazias quando há clientes mas nenhum tem voto", async () => {
    mockSatisfacaoRanking({
      clients: [{ id: "c1", nome: "Alpha", assessor_id: "a1", coordenador_id: "co1" }],
      entries: [],
      synthesis: [],
    });
    const r = await getRankingSatisfacao();
    expect(r.top).toEqual([]);
    expect(r.bottom).toEqual([]);
  });
});

describe("getProximosEventos", () => {
  it("retorna eventos ordenados por inicio asc com limite", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "calendar_events") {
        return {
          select: () => ({
            gte: () => ({
              lte: () => ({
                order: () => ({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      { id: "e1", titulo: "Reunião A", inicio: "2026-04-29T10:00:00Z", fim: "2026-04-29T11:00:00Z", sub_calendar: "agencia" },
                      { id: "e2", titulo: "Aniversário B", inicio: "2026-05-02T00:00:00Z", fim: "2026-05-02T23:59:59Z", sub_calendar: "aniversarios" },
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

    const eventos = await getProximosEventos(30, 10);
    expect(eventos).toHaveLength(2);
    expect(eventos[0].titulo).toBe("Reunião A");
    expect(eventos[1].sub_calendar).toBe("aniversarios");
  });
});

describe("getMesAguardandoAprovacao", () => {
  it("retorna mes_referencia mais recente com status pending_approval", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "commission_snapshots") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: vi.fn().mockResolvedValue({
                  data: [{ mes_referencia: "2026-03" }],
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const r = await getMesAguardandoAprovacao();
    expect(r).toEqual({ mes: "2026-03" });
  });

  it("retorna null quando todos snapshots aprovados", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "commission_snapshots") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const r = await getMesAguardandoAprovacao();
    expect(r).toBeNull();
  });
});

describe("getKpis with filter", () => {
  it("filtra clientes por assessorId quando passado", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 28)));

    fromMock.mockImplementation((table) => {
      if (table === "clients") {
        return {
          select: () => makeChainableQuery([
            { id: "c1", valor_mensal: 5000, data_entrada: "2025-01-01", data_churn: null, status: "ativo", tipo_relacao: "comum", assessor_id: "a1" },
          ]),
        };
      }
      if (table === "commission_snapshots") {
        return { select: () => ({ order: () => ({ limit: vi.fn().mockResolvedValue({ data: [] }) }) }) };
      }
      return {};
    });

    const r = await _getKpisImpl({ assessorId: "a1" });
    expect(r.carteiraAtiva.valor).toBe(5000);
    expect(r.clientesAtivos.quantidade).toBe(1);

    vi.useRealTimers();
  });

  it("filtra clientes por coordenadorId quando passado", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 28)));

    fromMock.mockImplementation((table) => {
      if (table === "clients") {
        return {
          select: () => makeChainableQuery([
            { id: "c1", valor_mensal: 3000, data_entrada: "2025-01-01", data_churn: null, status: "ativo", tipo_relacao: "comum", coordenador_id: "co1" },
            { id: "c2", valor_mensal: 4000, data_entrada: "2025-01-01", data_churn: null, status: "ativo", tipo_relacao: "comum", coordenador_id: "co1" },
          ]),
        };
      }
      if (table === "commission_snapshots") {
        return { select: () => ({ order: () => ({ limit: vi.fn().mockResolvedValue({ data: [] }) }) }) };
      }
      return {};
    });

    const r = await _getKpisImpl({ coordenadorId: "co1" });
    expect(r.carteiraAtiva.valor).toBe(7000);
    expect(r.clientesAtivos.quantidade).toBe(2);

    vi.useRealTimers();
  });
});

describe("getCarteiraTimeline with filter", () => {
  it("filtra clientes por assessorId quando passado", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 28)));

    fromMock.mockImplementation(() => ({
      select: () => makeChainableQuery([
        { id: "c1", valor_mensal: 5000, data_entrada: "2026-01-15", data_churn: null, assessor_id: "a1" },
      ]),
    }));

    const timeline = await _getCarteiraTimelineImpl(2, { assessorId: "a1" });
    expect(timeline).toHaveLength(2);
    expect(timeline[1].valorTotal).toBe(5000);

    vi.useRealTimers();
  });
});

describe("getEntradaChurn with filter", () => {
  it("filtra entradas e churns por coordenadorId quando passado", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 28)));

    fromMock.mockImplementation(() => ({
      select: () => makeChainableQuery([
        { id: "c1", data_entrada: "2026-04-01", data_churn: null, coordenador_id: "co1" },
      ]),
    }));

    const data = await _getEntradaChurnImpl(2, { coordenadorId: "co1" });
    expect(data[1].entradas).toBe(1);

    vi.useRealTimers();
  });
});

describe("getCarteiraPorAssessor with filter", () => {
  it("filtra clientes por coordenadorId quando passado (mostra só os assessores que ele coordena)", async () => {
    fromMock.mockImplementation(() => ({
      select: () => makeChainableQuery([
        { id: "c1", valor_mensal: 5000, assessor_id: "a1", assessor: { nome: "Ana" }, coordenador_id: "co1" },
        { id: "c2", valor_mensal: 3000, assessor_id: "a2", assessor: { nome: "Bruno" }, coordenador_id: "co1" },
      ]),
    }));

    const list = await _getCarteiraPorAssessorImpl({ coordenadorId: "co1" });
    expect(list).toHaveLength(2);
    expect(list[0].valorTotal).toBe(5000);
    expect(list[1].valorTotal).toBe(3000);
  });
});

describe("getRankingSatisfacao with filter", () => {
  it("filtra clientes por assessorId quando passado (filtra antes de calcular ranking)", async () => {
    // Apenas c1 (do assessor a1) é retornado pela query — filtro é aplicado no .eq("assessor_id", ...)
    mockSatisfacaoRanking({
      clients: [{ id: "c1", nome: "Alpha", assessor_id: "a1", coordenador_id: "co1" }],
      entries: [{ client_id: "c1", autor_id: "a1", papel_autor: "assessor", cor: "verde" }],
      synthesis: [
        { id: "s1", client_id: "c1", score_final: 9.5, cor_final: "verde", resumo_ia: "ok", divergencia_detectada: false, acao_sugerida: null, created_at: "2026-04-27" },
      ],
    });

    const r = await _getRankingSatisfacaoImpl({ assessorId: "a1" });
    expect(r.top).toHaveLength(1);
    expect(r.top[0].client_id).toBe("c1");
  });
});

describe("getProximosEventos with filter", () => {
  it("filtra eventos por participantes_ids contendo userId quando passado", async () => {
    const containsMock = vi.fn().mockReturnValue({
      gte: () => ({
        lte: () => ({
          order: () => ({
            limit: vi.fn().mockResolvedValue({
              data: [{ id: "e1", titulo: "Reunião X", inicio: "2026-04-29T10:00:00Z", fim: "2026-04-29T11:00:00Z", sub_calendar: "agencia" }],
            }),
          }),
        }),
      }),
    });
    fromMock.mockImplementation((table) => {
      if (table === "calendar_events") {
        return { select: () => ({ contains: containsMock }) };
      }
      return {};
    });

    const eventos = await _getProximosEventosImpl(30, 10, { userId: "u1" });
    expect(eventos).toHaveLength(1);
    expect(containsMock).toHaveBeenCalledWith("participantes_ids", ["u1"]);
  });
});
