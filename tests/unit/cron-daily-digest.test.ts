import { describe, it, expect, vi, beforeEach } from "vitest";

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

// Stubs para todos detectors — não rodam DB real
vi.mock("@/lib/cron/detectors/task-overdue", () => ({ detectOverdueTasks: vi.fn() }));
vi.mock("@/lib/cron/detectors/task-prazo-amanha", () => ({ detectTasksDuesoon: vi.fn() }));
vi.mock("@/lib/cron/detectors/evento-calendario-hoje", () => ({ detectEventsToday: vi.fn() }));
vi.mock("@/lib/cron/detectors/marco-zero-24h", () => ({ detectMarcosZero24h: vi.fn() }));
vi.mock("@/lib/cron/detectors/aniversario-socio-cliente", () => ({ detectClientBirthdays: vi.fn() }));
vi.mock("@/lib/cron/detectors/aniversario-colaborador", () => ({ detectColaboradorBirthdays: vi.fn() }));
vi.mock("@/lib/cron/detectors/renovacao-contrato", () => ({ detectRenovacoes: vi.fn() }));
vi.mock("@/lib/cron/detectors/satisfacao-pendente", () => ({ detectSatisfacaoPendente: vi.fn() }));

import { runDailyDigest } from "@/lib/cron/daily-digest";

beforeEach(() => {
  fromMock.mockReset();
});

describe("runDailyDigest", () => {
  it("retorna skipped quando já rodou hoje", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "cron_runs") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { ran_at: "2026-04-27T11:00:00Z" } }) }),
            }),
          }),
          insert: vi.fn(),
          update: vi.fn().mockReturnValue({ eq: () => ({ eq: vi.fn().mockResolvedValue({}) }) }),
        };
      }
      return {};
    });
    const result = await runDailyDigest();
    expect(result).toEqual(expect.objectContaining({ skipped: true }));
  });

  it("retorna counters quando primeira execução do dia", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "cron_runs") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({}),
          update: vi.fn().mockReturnValue({ eq: () => ({ eq: vi.fn().mockResolvedValue({}) }) }),
        };
      }
      return {};
    });
    const result = await runDailyDigest();
    expect(result).toHaveProperty("counters");
    expect(result).toHaveProperty("ran_at");
  });

  it("safeDetect captura erro de detector individual sem parar os outros", async () => {
    const { detectOverdueTasks } = await import("@/lib/cron/detectors/task-overdue");
    const { detectTasksDuesoon } = await import("@/lib/cron/detectors/task-prazo-amanha");
    vi.mocked(detectOverdueTasks).mockRejectedValueOnce(new Error("boom"));
    vi.mocked(detectTasksDuesoon).mockResolvedValueOnce(undefined);

    fromMock.mockImplementation((table) => {
      if (table === "cron_runs") {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }),
          }),
          insert: vi.fn().mockResolvedValue({}),
          update: vi.fn().mockReturnValue({ eq: () => ({ eq: vi.fn().mockResolvedValue({}) }) }),
        };
      }
      return {};
    });

    const result = await runDailyDigest();
    expect(result).toHaveProperty("counters");
    expect(detectTasksDuesoon).toHaveBeenCalled();
  });
});
