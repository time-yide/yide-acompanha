import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

import { getSnapshotForUserMonth } from "@/lib/comissoes/queries";

beforeEach(() => fromMock.mockReset());

it("retorna o snapshot do user no mês, ou null", async () => {
  fromMock.mockImplementation(() => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { user_id: "u1", mes_referencia: "2026-05", fixo: 3000, percentual_aplicado: 5, base_calculo: 5500, valor_variavel: 275, valor_total: 3275, status: "aprovado" },
            error: null,
          }),
        }),
      }),
    }),
  }));
  const r = await getSnapshotForUserMonth("u1", "2026-05");
  expect(r?.valor_total).toBe(3275);
  expect(r?.percentual_aplicado).toBe(5);
});
