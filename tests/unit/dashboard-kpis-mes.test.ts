// tests/unit/dashboard-kpis-mes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

import { _getKpisImpl } from "@/lib/dashboard/queries";

beforeEach(() => fromMock.mockReset());

// Helper: clients query resolve thenable independente de eq/is/neq.
function clientsChain(rows: unknown[]) {
  const chain: any = {
    select: () => chain, eq: () => chain, is: () => chain, neq: () => chain,
    then: (r: any) => Promise.resolve({ data: rows }).then(r),
  };
  return chain;
}

it("reconstrói carteira ativa no fim do mês escolhido", async () => {
  fromMock.mockImplementation((table: string) => {
    if (table === "clients") {
      return clientsChain([
        // ativo no fim de 2026-04 (entrou antes, sem churn)
        { id: "c1", valor_mensal: 5000, data_entrada: "2026-01-10", data_churn: null, status: "ativo", tipo_relacao: "comum", modalidade: "mensal" },
        // entrou DEPOIS de abril -> não conta em abril
        { id: "c2", valor_mensal: 9000, data_entrada: "2026-06-01", data_churn: null, status: "ativo", tipo_relacao: "comum", modalidade: "mensal" },
      ]);
    }
    if (table === "client_monthly_adjustments") {
      return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [] }) }) };
    }
    if (table === "commission_snapshots") {
      return { select: () => ({ order: () => ({ limit: vi.fn().mockResolvedValue({ data: [] }) }) }) };
    }
    return {};
  });

  const r = await _getKpisImpl({ assessorId: "a1" }, "2026-04");
  expect(r.carteiraAtiva.valor).toBe(5000); // só c1
  expect(r.clientesAtivos.quantidade).toBe(1);
});
