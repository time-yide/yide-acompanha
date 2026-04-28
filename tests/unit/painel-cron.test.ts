import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());
const dispatchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

vi.mock("@/lib/notificacoes/dispatch", () => ({
  dispatchNotification: dispatchMock,
}));

import { detectChecklistPainel } from "@/lib/cron/detectors/checklist-painel";

beforeEach(() => {
  fromMock.mockReset();
  dispatchMock.mockReset();
});

describe("detectChecklistPainel — reset mensal (dia 1)", () => {
  it("dia 1 do mês: cria checklist + 11 steps por cliente ativo (idempotente)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 4, 1, 12, 0, 0))); // 1º maio

    const upsertChecklistMock = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [{ id: "cl1", client_id: "c1" }],
        error: null,
      }),
    });
    const upsertStepsMock = vi.fn().mockResolvedValue({ error: null });

    fromMock.mockImplementation((table) => {
      if (table === "clients") {
        return {
          select: () => ({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: "c1", assessor_id: "u-assessor", organization_id: "org1", pacote_post_padrao: 12 },
              ],
            }),
          }),
        };
      }
      if (table === "client_monthly_checklist") {
        return { upsert: upsertChecklistMock };
      }
      if (table === "checklist_step") {
        return { upsert: upsertStepsMock };
      }
      return {};
    });

    const counters = { checklist_painel: 0 };
    await detectChecklistPainel(counters);

    expect(upsertChecklistMock).toHaveBeenCalled();
    expect(upsertStepsMock).toHaveBeenCalled();
    expect(counters.checklist_painel).toBeGreaterThan(0);

    vi.useRealTimers();
  });
});

describe("detectChecklistPainel — atrasos", () => {
  it("dia 15 do mês: marca cronograma (deadline dia 7) como atrasada se não pronto", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 4, 15, 12, 0, 0)));

    const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    fromMock.mockImplementation((table) => {
      if (table === "clients") {
        return {
          select: () => ({ eq: vi.fn().mockResolvedValue({ data: [] }) }),
        };
      }
      if (table === "checklist_step") {
        return {
          select: () => ({
            eq: () => ({
              neq: vi.fn().mockResolvedValue({
                data: [
                  { id: "s1", step_key: "cronograma", status: "em_andamento", responsavel_id: "u-ass", checklist_id: "cl1" },
                  { id: "s2", step_key: "postagem", status: "pendente", responsavel_id: "u-ass", checklist_id: "cl1" },
                ],
              }),
            }),
          }),
          update: updateMock,
        };
      }
      return {};
    });

    const counters = { checklist_painel: 0 };
    await detectChecklistPainel(counters);

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "atrasada" }));
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ evento_tipo: "checklist_step_atrasada" }),
    );

    vi.useRealTimers();
  });
});
