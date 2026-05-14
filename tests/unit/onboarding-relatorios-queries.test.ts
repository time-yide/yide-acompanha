import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ is: () => Promise.resolve({ data: [], error: null }) }),
      }),
    }),
  }),
}));

import {
  periodToRange,
  isValidPeriodKey,
  computeMetricas,
} from "@/lib/onboarding-relatorios/queries";

beforeEach(() => {
  vi.useFakeTimers();
  // 2026-05-15 12:00 UTC (quinta-feira do meio de maio)
  vi.setSystemTime(new Date("2026-05-15T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("isValidPeriodKey", () => {
  it("aceita as 4 keys válidas", () => {
    expect(isValidPeriodKey("este_mes")).toBe(true);
    expect(isValidPeriodKey("mes_passado")).toBe(true);
    expect(isValidPeriodKey("ultimos_3_meses")).toBe(true);
    expect(isValidPeriodKey("este_ano")).toBe(true);
  });
  it("rejeita lixo", () => {
    expect(isValidPeriodKey("foo")).toBe(false);
    expect(isValidPeriodKey(null)).toBe(false);
    expect(isValidPeriodKey(undefined)).toBe(false);
    expect(isValidPeriodKey(42)).toBe(false);
  });
});

describe("periodToRange", () => {
  it("este_mes: do 1º ao último dia do mês corrente", () => {
    const r = periodToRange("este_mes");
    expect(r.from.toISOString().slice(0, 10)).toBe("2026-05-01");
    expect(r.to.toISOString().slice(0, 10)).toBe("2026-05-31");
  });
  it("mes_passado: 1º ao último do mês anterior", () => {
    const r = periodToRange("mes_passado");
    expect(r.from.toISOString().slice(0, 10)).toBe("2026-04-01");
    expect(r.to.toISOString().slice(0, 10)).toBe("2026-04-30");
  });
  it("ultimos_3_meses: 3 meses pra trás até hoje", () => {
    const r = periodToRange("ultimos_3_meses");
    expect(r.from.toISOString().slice(0, 10)).toBe("2026-03-01");
    expect(r.to.toISOString().slice(0, 10)).toBe("2026-05-31");
  });
  it("este_ano: 1º jan ao último do ano corrente", () => {
    const r = periodToRange("este_ano");
    expect(r.from.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(r.to.toISOString().slice(0, 10)).toBe("2026-12-31");
  });
});

describe("computeMetricas", () => {
  it("caso normal — todos divisores não-zero", () => {
    const m = computeMetricas({
      gasto: 10000,
      leadsGerados: 100,
      vendasFechadas: 10,
      valorVendas: 50000,
    });
    expect(m.cpl).toBe(100);
    expect(m.cac).toBe(1000);
    expect(m.conversao).toBe(10);
    expect(m.roi).toBe(400);
    expect(m.ticket_medio).toBe(5000);
  });

  it("leads_gerados = 0 → CPL e Conversão são null", () => {
    const m = computeMetricas({
      gasto: 1000, leadsGerados: 0, vendasFechadas: 0, valorVendas: 0,
    });
    expect(m.cpl).toBeNull();
    expect(m.conversao).toBeNull();
  });

  it("vendas_fechadas = 0 → CAC e Ticket são null", () => {
    const m = computeMetricas({
      gasto: 1000, leadsGerados: 50, vendasFechadas: 0, valorVendas: 0,
    });
    expect(m.cac).toBeNull();
    expect(m.ticket_medio).toBeNull();
  });

  it("gasto = 0 → ROI null", () => {
    const m = computeMetricas({
      gasto: 0, leadsGerados: 50, vendasFechadas: 5, valorVendas: 10000,
    });
    expect(m.roi).toBeNull();
  });

  it("ROI negativo quando valor_vendas < gasto", () => {
    const m = computeMetricas({
      gasto: 10000, leadsGerados: 100, vendasFechadas: 5, valorVendas: 5000,
    });
    expect(m.roi).toBe(-50);
  });
});
