import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());
const requireAuthMock = vi.hoisted(() => vi.fn());
const logAuditMock = vi.hoisted(() => vi.fn());
const dispatchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromMock }),
}));

vi.mock("@/lib/auth/session", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/lib/audit/log", () => ({
  logAudit: logAuditMock,
}));

vi.mock("@/lib/notificacoes/dispatch", () => ({
  dispatchNotification: dispatchMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { adjustSnapshotAction, approveMonthAction } from "@/lib/comissoes/actions";

beforeEach(() => {
  fromMock.mockReset();
  requireAuthMock.mockReset();
  logAuditMock.mockReset();
  dispatchMock.mockReset();
  requireAuthMock.mockResolvedValue({ id: "socio-1", role: "socio", nome: "Sócio" });
});

describe("adjustSnapshotAction", () => {
  it("rejeita justificativa < 5 chars", async () => {
    const fd = new FormData();
    fd.set("snapshot_id", "00000000-0000-0000-0000-000000000000");
    fd.set("novo_valor_variavel", "100");
    fd.set("justificativa", "ok");
    const r = await adjustSnapshotAction(fd);
    expect(r).toEqual(expect.objectContaining({ error: expect.stringContaining("Justificativa") }));
  });

  it("rejeita snapshot já aprovado", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "commission_snapshots") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { id: "s1", status: "aprovado", fixo: 3000, valor_variavel: 500, ajuste_manual: 0 },
              }),
            }),
          }),
        };
      }
      return {};
    });
    const fd = new FormData();
    fd.set("snapshot_id", "00000000-0000-0000-0000-000000000000");
    fd.set("novo_valor_variavel", "600");
    fd.set("justificativa", "Bonus excepcional");
    const r = await adjustSnapshotAction(fd);
    expect(r).toEqual(expect.objectContaining({ error: expect.stringContaining("aprovado") }));
  });

  it("recalcula ajuste_manual e valor_total ao salvar", async () => {
    const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    fromMock.mockImplementation((table) => {
      if (table === "commission_snapshots") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { id: "s1", status: "pending_approval", fixo: 3000, valor_variavel: 500, ajuste_manual: 0 },
              }),
            }),
          }),
          update: updateMock,
        };
      }
      return {};
    });
    const fd = new FormData();
    fd.set("snapshot_id", "00000000-0000-0000-0000-000000000000");
    fd.set("novo_valor_variavel", "600");
    fd.set("justificativa", "Bonus excepcional");
    const r = await adjustSnapshotAction(fd);
    expect(r).toEqual({ success: true });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        valor_variavel: 600,
        ajuste_manual: 100,
        valor_total: 3600,
        justificativa_ajuste: "Bonus excepcional",
      }),
    );
    expect(logAuditMock).toHaveBeenCalled();
  });
});

describe("approveMonthAction", () => {
  it("rejeita se algum snapshot do mês tem valor_total < 0", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "commission_snapshots") {
        return {
          select: () => ({
            eq: () => ({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: "s1", user_id: "u1", valor_total: 500 },
                  { id: "s2", user_id: "u2", valor_total: -50 },
                ],
              }),
            }),
          }),
        };
      }
      return {};
    });
    const fd = new FormData();
    fd.set("mes_referencia", "2026-04");
    const r = await approveMonthAction(fd);
    expect(r).toEqual(expect.objectContaining({ error: expect.stringContaining("negativo") }));
  });
});
