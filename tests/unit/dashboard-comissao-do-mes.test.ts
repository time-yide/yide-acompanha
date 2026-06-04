import { it, expect, vi, beforeEach } from "vitest";
/* eslint-disable @typescript-eslint/no-explicit-any -- mocks de query encadeada do supabase */

const getComissaoPrevistaMock = vi.hoisted(() => vi.fn());
const getSnapshotForUserMonthMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/comissoes/queries", () => ({
  getSnapshotForUserMonth: getSnapshotForUserMonthMock,
}));

// getComissaoPrevista vive no MESMO módulo; testamos getComissaoDoMes
// stubando a leitura de snapshot e a query via service-role.
const fromMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

import { getComissaoDoMes } from "@/lib/dashboard/comissao-prevista";

beforeEach(() => {
  getComissaoPrevistaMock.mockReset();
  getSnapshotForUserMonthMock.mockReset();
  fromMock.mockReset();
});

it("mês fechado COM snapshot -> usa o snapshot, status 'fechado'", async () => {
  getSnapshotForUserMonthMock.mockResolvedValue({
    fixo: 3000, percentual_aplicado: 5, base_calculo: 5500, valor_variavel: 275, valor_total: 3275,
  });
  const r = await getComissaoDoMes("u1", "assessor", "2026-05", false);
  expect(r.status).toBe("fechado");
  expect(r.valor).toBe(3275);
  expect(r.valorVariavel).toBe(275);
  expect(r.baseCalculo).toBe(5500);
  expect(r.percentual).toBe(5);
});

it("mês fechado SEM snapshot -> recálculo, status 'estimado'", async () => {
  getSnapshotForUserMonthMock.mockResolvedValue(null);
  // profiles + clients vazios -> recálculo devolve zeros + fixo
  fromMock.mockImplementation((table: string) => {
    if (table === "profiles") {
      return { select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({ data: { fixo_mensal: 1000, comissao_percent: 5, comissao_primeiro_mes_percent: 0 } }) }) }) };
    }
    if (table === "clients") {
      const chain: any = { eq: vi.fn(), is: vi.fn(), then: (r: any) => Promise.resolve({ data: [] }).then(r) };
      chain.eq.mockReturnValue(chain); chain.is.mockReturnValue(chain);
      return { select: () => chain };
    }
    if (table === "client_monthly_adjustments") {
      return { select: () => ({ in: () => ({ eq: vi.fn().mockResolvedValue({ data: [] }) }) }) };
    }
    return {};
  });
  const r = await getComissaoDoMes("u1", "assessor", "2026-05", false);
  expect(r.status).toBe("estimado");
  expect(r.valor).toBe(1000);
});

it("mês atual -> preview ao vivo, status 'em_curso'", async () => {
  fromMock.mockImplementation((table: string) => {
    if (table === "profiles") {
      return { select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({ data: { fixo_mensal: 2000, comissao_percent: 5, comissao_primeiro_mes_percent: 0 } }) }) }) };
    }
    if (table === "clients") {
      const chain: any = { eq: vi.fn(), is: vi.fn(), then: (r: any) => Promise.resolve({ data: [] }).then(r) };
      chain.eq.mockReturnValue(chain); chain.is.mockReturnValue(chain);
      return { select: () => chain };
    }
    if (table === "client_monthly_adjustments") {
      return { select: () => ({ in: () => ({ eq: vi.fn().mockResolvedValue({ data: [] }) }) }) };
    }
    return {};
  });
  const r = await getComissaoDoMes("u1", "assessor", "2026-06", true);
  expect(r.status).toBe("em_curso");
  expect(r.valor).toBe(2000);
  expect(getSnapshotForUserMonthMock).not.toHaveBeenCalled();
});
