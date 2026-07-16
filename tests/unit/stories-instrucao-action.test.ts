import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());
const requireAuthMock = vi.hoisted(() => vi.fn());
const unitIdsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({ requireAuth: requireAuthMock }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => ({ from: fromMock }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: fromMock }) }));
vi.mock("@/lib/units/filter-helpers", () => ({
  getClientIdsForActiveUnit: unitIdsMock,
  getProfileIdsForActiveUnit: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { updateClienteStoriesInstrucaoAction } from "@/lib/painel/stories-actions";

const CID = "1a9a33c5-afde-4df5-92c6-6784500e6d91";
const ASSESSOR = "a63d8245-dcad-4b7b-8c75-2d91bb4944e0";

function fd(obj: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}

/**
 * Mock: clients.select("assessor_id").eq().single() -> { data: {assessor_id} }
 * e clients.update().eq().select("id") -> { data, error }.
 */
function mockClients(assessorId: string | null, updateResult: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue({ data: { assessor_id: assessorId }, error: null });
  const selectEq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq: selectEq }));
  // update chain
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const upChain: any = {};
  upChain.eq = vi.fn(() => upChain);
  upChain.select = vi.fn(() => Promise.resolve(updateResult));
  const update = vi.fn(() => upChain);
  fromMock.mockImplementation((t: string) => (t === "clients" ? { select, update } : {}));
  return { update, upChain };
}

beforeEach(() => {
  fromMock.mockReset();
  requireAuthMock.mockReset();
  unitIdsMock.mockReset().mockResolvedValue(null);
});

describe("updateClienteStoriesInstrucaoAction", () => {
  it("manager edita a instrução", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "coordenador" });
    const { update } = mockClients(ASSESSOR, { data: [{ id: CID }], error: null });
    const r = await updateClienteStoriesInstrucaoAction(fd({ client_id: CID, instrucao: "Focar em bastidores" }));
    expect(r.success).toBe(true);
    expect(update).toHaveBeenCalledWith({ stories_instrucao: "Focar em bastidores" });
  });

  it("assessor dono do cliente edita", async () => {
    requireAuthMock.mockResolvedValue({ id: ASSESSOR, role: "assessor" });
    mockClients(ASSESSOR, { data: [{ id: CID }], error: null });
    const r = await updateClienteStoriesInstrucaoAction(fd({ client_id: CID, instrucao: "oi" }));
    expect(r.success).toBe(true);
  });

  it("outro assessor (não dono) é negado", async () => {
    requireAuthMock.mockResolvedValue({ id: "outro-assessor", role: "assessor" });
    mockClients(ASSESSOR, { data: [{ id: CID }], error: null });
    const r = await updateClienteStoriesInstrucaoAction(fd({ client_id: CID, instrucao: "x" }));
    expect(r.error).toBe("Sem permissão");
  });

  it("fast_midia é negado", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "fast_midia" });
    mockClients(ASSESSOR, { data: [{ id: CID }], error: null });
    const r = await updateClienteStoriesInstrucaoAction(fd({ client_id: CID, instrucao: "x" }));
    expect(r.error).toBe("Sem permissão");
  });

  it("texto vazio limpa (grava null)", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "adm" });
    const { update } = mockClients(ASSESSOR, { data: [{ id: CID }], error: null });
    const r = await updateClienteStoriesInstrucaoAction(fd({ client_id: CID, instrucao: "   " }));
    expect(r.success).toBe(true);
    expect(update).toHaveBeenCalledWith({ stories_instrucao: null });
  });

  it("cliente fora da unidade é negado", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "adm" });
    unitIdsMock.mockResolvedValue(["outro-id"]);
    mockClients(ASSESSOR, { data: [{ id: CID }], error: null });
    const r = await updateClienteStoriesInstrucaoAction(fd({ client_id: CID, instrucao: "x" }));
    expect(r.error).toBe("Cliente fora da unidade ativa");
  });

  it("texto > 1000 é rejeitado", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "adm" });
    mockClients(ASSESSOR, { data: [{ id: CID }], error: null });
    const r = await updateClienteStoriesInstrucaoAction(fd({ client_id: CID, instrucao: "a".repeat(1001) }));
    expect(r.error).toBeTruthy();
    expect(r.success).toBeUndefined();
  });
});
