import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: vi.fn() }),
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { resolvePeriodo } from "@/lib/dashboard/personal";

describe("resolvePeriodo", () => {
  it("'mes_atual' retorna início e fim do mês corrente em UTC ISO", () => {
    const ref = new Date("2026-05-15T10:00:00Z");
    const r = resolvePeriodo("mes_atual", ref);
    expect(r.fromIso.startsWith("2026-05-01")).toBe(true);
    expect(r.toIso.startsWith("2026-06-01")).toBe(true);
  });

  it("'mes_anterior' retorna mês passado fechado", () => {
    const ref = new Date("2026-05-15T10:00:00Z");
    const r = resolvePeriodo("mes_anterior", ref);
    expect(r.fromIso.startsWith("2026-04-01")).toBe(true);
    expect(r.toIso.startsWith("2026-05-01")).toBe(true);
  });

  it("'dias_7' retorna últimos 7 dias rolling", () => {
    const ref = new Date("2026-05-15T10:00:00Z");
    const r = resolvePeriodo("dias_7", ref);
    expect(r.fromIso.startsWith("2026-05-08")).toBe(true);
    expect(r.toIso.startsWith("2026-05-15")).toBe(true);
  });

  it("'total' retorna janela aberta (from no épico, to no futuro)", () => {
    const ref = new Date("2026-05-15T10:00:00Z");
    const r = resolvePeriodo("total", ref);
    expect(new Date(r.fromIso).getFullYear()).toBeLessThanOrEqual(2000);
    expect(new Date(r.toIso).getFullYear()).toBeGreaterThanOrEqual(2100);
  });

  it("valor desconhecido cai em 'mes_atual'", () => {
    const ref = new Date("2026-05-15T10:00:00Z");
    const r = resolvePeriodo("xyz" as never, ref);
    expect(r.fromIso.startsWith("2026-05-01")).toBe(true);
  });
});
