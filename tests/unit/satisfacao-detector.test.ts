import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());
const dispatchMock = vi.hoisted(() => vi.fn());
const synthesizeStoreMock = vi.hoisted(() => vi.fn());
const listClientsAtivosMock = vi.hoisted(() => vi.fn());
const listAssessoresMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

vi.mock("@/lib/notificacoes/dispatch", () => ({
  dispatchNotification: dispatchMock,
}));

vi.mock("@/lib/satisfacao/actions", () => ({
  synthesizeAndStore: synthesizeStoreMock,
}));

vi.mock("@/lib/satisfacao/queries", () => ({
  listClientsWithEntriesButNoSynthesis: vi.fn().mockResolvedValue(["c1", "c2"]),
}));

import { detectSatisfacaoPendente } from "@/lib/cron/detectors/satisfacao-pendente";

beforeEach(() => {
  fromMock.mockReset();
  dispatchMock.mockReset();
  synthesizeStoreMock.mockReset();
});

describe("detectSatisfacaoPendente", () => {
  it("segunda-feira: cria pendentes e dispara notificação", async () => {
    // Mock Date.now / getUTCDay() pra segunda
    vi.useFakeTimers();
    // Segunda-feira: 2026-04-13 é segunda
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 13, 12, 0, 0)));

    const insertMock = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockImplementation((table) => {
      if (table === "clients") {
        return {
          select: () => ({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: "c1", assessor_id: "a1", coordenador_id: "co1" },
                { id: "c2", assessor_id: "a1", coordenador_id: "co1" },
              ],
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: "co1", role: "coordenador" },
                { id: "a1", role: "assessor" },
              ],
            }),
          }),
        };
      }
      if (table === "satisfaction_entries") {
        return { insert: insertMock };
      }
      return {};
    });

    const counters = { satisfacao_pendente: 0 };
    await detectSatisfacaoPendente(counters);

    expect(insertMock).toHaveBeenCalled();
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ evento_tipo: "satisfacao_pendente" }),
    );
    expect(counters.satisfacao_pendente).toBeGreaterThan(0);

    vi.useRealTimers();
  });

  it("quinta-feira: roda síntese pra clientes pendentes", async () => {
    vi.useFakeTimers();
    // Quinta-feira: 2026-04-16
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 16, 12, 0, 0)));

    const counters = { satisfacao_pendente: 0 };
    await detectSatisfacaoPendente(counters);

    expect(synthesizeStoreMock).toHaveBeenCalledTimes(2);
    expect(synthesizeStoreMock).toHaveBeenCalledWith("c1", expect.any(String));
    expect(synthesizeStoreMock).toHaveBeenCalledWith("c2", expect.any(String));

    vi.useRealTimers();
  });

  it("outros dias da semana: no-op", async () => {
    vi.useFakeTimers();
    // Quarta: 2026-04-15
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 15, 12, 0, 0)));

    const counters = { satisfacao_pendente: 0 };
    await detectSatisfacaoPendente(counters);

    expect(dispatchMock).not.toHaveBeenCalled();
    expect(synthesizeStoreMock).not.toHaveBeenCalled();
    expect(counters.satisfacao_pendente).toBe(0);

    vi.useRealTimers();
  });
});
