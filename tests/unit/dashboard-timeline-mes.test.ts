// tests/unit/dashboard-timeline-mes.test.ts
import { it, expect, vi, beforeEach } from "vitest";
/* eslint-disable @typescript-eslint/no-explicit-any -- mocks de query encadeada do supabase */
const fromMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => ({ from: fromMock }) }));
import { _getCarteiraTimelineImpl } from "@/lib/dashboard/queries";
beforeEach(() => fromMock.mockReset());

function clientsChain(rows: unknown[]) {
  const chain: any = { select: () => chain, eq: () => chain, is: () => chain, then: (r: any) => Promise.resolve({ data: rows }).then(r) };
  return chain;
}

it("a timeline termina no mês escolhido", async () => {
  fromMock.mockImplementation(() => clientsChain([]));
  const r = await _getCarteiraTimelineImpl(3, undefined, "2026-04");
  expect(r.map((p) => p.mes)).toEqual(["2026-02", "2026-03", "2026-04"]);
});
