import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());
const calculateMock = vi.hoisted(() => vi.fn());
const dispatchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

vi.mock("@/lib/comissoes/calculator", () => ({
  calculateCommission: calculateMock,
}));

vi.mock("@/lib/notificacoes/dispatch", () => ({
  dispatchNotification: dispatchMock,
}));

import { generateMonthlySnapshots } from "@/lib/comissoes/generator";

beforeEach(() => {
  fromMock.mockReset();
  calculateMock.mockReset();
  dispatchMock.mockReset();
});

describe("generateMonthlySnapshots", () => {
  it("retorna skipped se já existe snapshot pro mês", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "commission_snapshots") {
        return {
          select: () => ({
            eq: () => ({
              limit: vi.fn().mockResolvedValue({ data: [{ id: "x" }] }),
            }),
          }),
        };
      }
      return {};
    });
    const r = await generateMonthlySnapshots("2026-04");
    expect(r).toEqual(expect.objectContaining({ skipped: true }));
    expect(calculateMock).not.toHaveBeenCalled();
  });

  it("skip Sócio e Inativos: query filtra antes de chamar calculator", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "commission_snapshots") {
        return {
          select: () => ({
            eq: () => ({
              limit: vi.fn().mockResolvedValue({ data: [] }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: vi.fn().mockResolvedValue({ data: { id: "snap1" } }),
            }),
          }),
        };
      }
      if (table === "commission_snapshot_items") {
        return { insert: vi.fn().mockResolvedValue({}) };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              neq: vi.fn().mockResolvedValue({ data: [{ id: "u1", role: "assessor" }] }),
            }),
          }),
        };
      }
      return {};
    });
    calculateMock.mockResolvedValue({
      snapshot: { fixo: 3000, percentual_aplicado: 5, base_calculo: 10000, valor_variavel: 500 },
      items: [{ tipo: "fixo", descricao: "Fixo", base: 0, percentual: 0, valor: 3000 }],
    });
    const r = await generateMonthlySnapshots("2026-04");
    expect(r).toEqual(expect.objectContaining({ count: 1 }));
    expect(calculateMock).toHaveBeenCalledTimes(1);
    expect(dispatchMock).toHaveBeenCalledTimes(1);
  });

  it("dispara mes_aguardando_aprovacao depois de inserir todos", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "commission_snapshots") {
        return {
          select: () => ({
            eq: () => ({
              limit: vi.fn().mockResolvedValue({ data: [] }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: vi.fn().mockResolvedValue({ data: { id: "snap1" } }),
            }),
          }),
        };
      }
      if (table === "commission_snapshot_items") {
        return { insert: vi.fn().mockResolvedValue({}) };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              neq: vi.fn().mockResolvedValue({ data: [] }),
            }),
          }),
        };
      }
      return {};
    });
    await generateMonthlySnapshots("2026-04");
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ evento_tipo: "mes_aguardando_aprovacao" }),
    );
  });
});
