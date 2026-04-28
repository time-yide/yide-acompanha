import { describe, it, expect, vi, beforeEach } from "vitest";

const fromCookieMock = vi.hoisted(() => vi.fn());
const fromServiceMock = vi.hoisted(() => vi.fn());
const requireAuthMock = vi.hoisted(() => vi.fn());
const synthesizeMock = vi.hoisted(() => vi.fn());
const dispatchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromCookieMock }),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: fromServiceMock }),
}));

vi.mock("@/lib/auth/session", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/lib/satisfacao/synthesizer", () => ({
  synthesizeClientSatisfaction: synthesizeMock,
}));

vi.mock("@/lib/notificacoes/dispatch", () => ({
  dispatchNotification: dispatchMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { setSatisfactionColorAction } from "@/lib/satisfacao/actions";

beforeEach(() => {
  fromCookieMock.mockReset();
  fromServiceMock.mockReset();
  requireAuthMock.mockReset();
  synthesizeMock.mockReset();
  dispatchMock.mockReset();
  requireAuthMock.mockResolvedValue({ id: "u1", role: "coordenador", nome: "Maria" });
});

describe("setSatisfactionColorAction", () => {
  it("rejeita cor inválida", async () => {
    const fd = new FormData();
    fd.set("client_id", "00000000-0000-0000-0000-000000000000");
    fd.set("cor", "azul");
    const r = await setSatisfactionColorAction(fd);
    expect(r).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it("upsert da entry e retorna triggeredSynthesis=false quando 1ª avaliação", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    fromCookieMock.mockImplementation((table) => {
      if (table === "satisfaction_entries") return { upsert: upsertMock };
      return {};
    });
    fromServiceMock.mockImplementation((table) => {
      if (table === "satisfaction_entries") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                not: vi.fn().mockResolvedValue({ count: 1 }), // só 1 entry preenchida = 1ª avaliação
              }),
            }),
          }),
        };
      }
      return {};
    });
    const fd = new FormData();
    fd.set("client_id", "00000000-0000-0000-0000-000000000000");
    fd.set("cor", "verde");
    const r = await setSatisfactionColorAction(fd);
    expect(r).toEqual(expect.objectContaining({ success: true, triggeredSynthesis: false }));
    expect(synthesizeMock).not.toHaveBeenCalled();
  });

  it("dispara síntese quando 2ª avaliação preenchida (countFilled >= 2)", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const upsertSynthMock = vi.fn().mockResolvedValue({ error: null });

    fromCookieMock.mockImplementation((table) => {
      if (table === "satisfaction_entries") return { upsert: upsertMock };
      return {};
    });

    fromServiceMock.mockImplementation((table) => {
      if (table === "satisfaction_entries") {
        // .select(cols, opts) needs to differentiate: count query vs data query
        return {
          select: (_cols: string, opts?: { head?: boolean }) => {
            if (opts?.head) {
              // countFilledForClient
              return {
                eq: () => ({
                  eq: () => ({
                    not: vi.fn().mockResolvedValue({ count: 2 }),
                  }),
                }),
              };
            }
            // synthesizeAndStore internal entries fetch
            return {
              eq: () => ({
                eq: () => ({
                  not: vi.fn().mockResolvedValue({
                    data: [
                      { papel_autor: "coordenador", cor: "verde", comentario: "ok" },
                      { papel_autor: "assessor", cor: "verde", comentario: null },
                    ],
                  }),
                }),
              }),
            };
          },
        };
      }
      if (table === "clients") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { id: "c1", nome: "Cliente", valor_mensal: 4000, data_entrada: "2025-01-01", servico_contratado: "X" },
              }),
            }),
          }),
        };
      }
      if (table === "satisfaction_synthesis") {
        // Two call chains used:
        //  - getExistingSynthesis: .select().eq().eq().maybeSingle()
        //  - synthesizeAndStore history: .select().eq().order().limit()
        //  - synthesizeAndStore upsert
        return {
          upsert: upsertSynthMock,
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              }),
              order: () => ({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    synthesizeMock.mockResolvedValue({
      score_final: 9.0,
      cor_final: "verde",
      resumo_ia: "ok",
      divergencia_detectada: false,
      acao_sugerida: null,
      ai_tokens_used: 100,
    });

    const fd = new FormData();
    fd.set("client_id", "00000000-0000-0000-0000-000000000000");
    fd.set("cor", "verde");
    const r = await setSatisfactionColorAction(fd);
    expect(r).toEqual(expect.objectContaining({ success: true, triggeredSynthesis: true }));
    expect(synthesizeMock).toHaveBeenCalledTimes(1);
    // Confirma que ambas as entries foram passadas (não só a "seed")
    const callArgs = synthesizeMock.mock.calls[0][0];
    expect(callArgs.current_entries).toHaveLength(2);
    expect(upsertSynthMock).toHaveBeenCalled();
  });

  it("não duplica síntese se já existe (idempotência)", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    fromCookieMock.mockImplementation((table) => {
      if (table === "satisfaction_entries") return { upsert: upsertMock };
      return {};
    });

    fromServiceMock.mockImplementation((table) => {
      if (table === "satisfaction_entries") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                not: vi.fn().mockResolvedValue({ count: 2 }),
              }),
            }),
          }),
        };
      }
      if (table === "satisfaction_synthesis") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: "s1", cor_final: "verde" } }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const fd = new FormData();
    fd.set("client_id", "00000000-0000-0000-0000-000000000000");
    fd.set("cor", "verde");
    const r = await setSatisfactionColorAction(fd);
    expect(r).toEqual(expect.objectContaining({ success: true }));
    // Síntese já existe, então não chama de novo
    expect(synthesizeMock).not.toHaveBeenCalled();
  });
});
