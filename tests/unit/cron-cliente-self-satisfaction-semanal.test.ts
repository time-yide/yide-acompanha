import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());
const sendPushToClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

vi.mock("@/lib/cliente-portal/push", () => ({
  sendPushToClient: sendPushToClientMock,
}));

vi.mock("@/lib/satisfacao/iso-week", () => ({
  currentIsoWeek: () => "2026-W20",
}));

import { detectClienteSelfSatisfactionSemanal } from "@/lib/cron/detectors/cliente-self-satisfaction-semanal";

function setupDB(clients: Array<{ id: string }>, satisfacoesDaSemana: Array<{ client_id: string }>) {
  fromMock.mockImplementation((table: string) => {
    if (table === "clients") {
      return {
        select: () => ({
          eq: () => ({
            is: () => Promise.resolve({ data: clients, error: null }),
          }),
        }),
      };
    }
    if (table === "client_self_satisfaction") {
      return {
        select: () => ({
          gte: () => Promise.resolve({ data: satisfacoesDaSemana, error: null }),
        }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });
}

beforeEach(() => {
  fromMock.mockReset();
  sendPushToClientMock.mockReset();
  sendPushToClientMock.mockResolvedValue(undefined);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("detectClienteSelfSatisfactionSemanal", () => {
  it("não dispara nada fora de segunda-feira", async () => {
    vi.setSystemTime(new Date("2026-05-17T10:00:00Z")); // Domingo
    const counters = { cliente_self_satisfaction_semanal: 0 };
    await detectClienteSelfSatisfactionSemanal(counters);
    expect(sendPushToClientMock).not.toHaveBeenCalled();
    expect(counters.cliente_self_satisfaction_semanal).toBe(0);
  });

  it("na segunda, dispara push pros clientes sem entry da semana atual", async () => {
    vi.setSystemTime(new Date("2026-05-18T10:00:00Z")); // Segunda
    setupDB(
      [{ id: "c1" }, { id: "c2" }, { id: "c3" }],
      [{ client_id: "c2" }],
    );
    const counters = { cliente_self_satisfaction_semanal: 0 };
    await detectClienteSelfSatisfactionSemanal(counters);
    expect(sendPushToClientMock).toHaveBeenCalledTimes(2);
    expect(sendPushToClientMock).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ title: expect.stringContaining("Yide"), url: "/cliente" }),
    );
    expect(sendPushToClientMock).toHaveBeenCalledWith(
      "c3",
      expect.any(Object),
    );
    expect(sendPushToClientMock).not.toHaveBeenCalledWith("c2", expect.any(Object));
    expect(counters.cliente_self_satisfaction_semanal).toBe(2);
  });

  it("na segunda, se todos já avaliaram, não dispara nada", async () => {
    vi.setSystemTime(new Date("2026-05-18T10:00:00Z"));
    setupDB(
      [{ id: "c1" }, { id: "c2" }],
      [{ client_id: "c1" }, { client_id: "c2" }],
    );
    const counters = { cliente_self_satisfaction_semanal: 0 };
    await detectClienteSelfSatisfactionSemanal(counters);
    expect(sendPushToClientMock).not.toHaveBeenCalled();
    expect(counters.cliente_self_satisfaction_semanal).toBe(0);
  });
});
