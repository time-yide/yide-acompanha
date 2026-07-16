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

import {
  addClienteStoriesAction,
  updateClienteDiariaStoriesAction,
  removeClienteStoriesAction,
} from "@/lib/painel/stories-actions";

const CID = "1a9a33c5-afde-4df5-92c6-6784500e6d91";

function fd(obj: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}

/** Mock chainable de clients.update(...).eq(...)[.eq(...)].select(...) */
function mockClientsUpdate(result: { data: unknown; error: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  chain.eq = vi.fn(() => chain);
  chain.select = vi.fn(() => Promise.resolve(result));
  const update = vi.fn(() => chain);
  fromMock.mockImplementation((t: string) => (t === "clients" ? { update } : {}));
  return { update, chain };
}

beforeEach(() => {
  fromMock.mockReset();
  requireAuthMock.mockReset();
  unitIdsMock.mockReset().mockResolvedValue(null); // null = sem filtro de unidade
});

describe("addClienteStoriesAction", () => {
  it("liga tem_stories e grava a diária", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "fast_midia" });
    const { update } = mockClientsUpdate({ data: [{ id: CID }], error: null });
    const r = await addClienteStoriesAction(fd({ client_id: CID, quantidade_diaria: "3" }));
    expect(r.error).toBeUndefined();
    expect(r.success).toBe(true);
    expect(update).toHaveBeenCalledWith({ tem_stories: true, quantidade_diaria_stories: 3 });
  });

  it("bloqueia role sem permissão", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "videomaker" });
    mockClientsUpdate({ data: [{ id: CID }], error: null });
    const r = await addClienteStoriesAction(fd({ client_id: CID, quantidade_diaria: "3" }));
    expect(r.error).toBe("Sem permissão");
  });

  it("rejeita cliente fora da unidade ativa", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "coordenador" });
    unitIdsMock.mockResolvedValue(["outro-id"]);
    mockClientsUpdate({ data: [{ id: CID }], error: null });
    const r = await addClienteStoriesAction(fd({ client_id: CID, quantidade_diaria: "3" }));
    expect(r.error).toBe("Cliente fora da unidade ativa");
  });

  it("rejeita quantidade fora de 1..99", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "fast_midia" });
    mockClientsUpdate({ data: [{ id: CID }], error: null });
    const r = await addClienteStoriesAction(fd({ client_id: CID, quantidade_diaria: "0" }));
    expect(r.error).toBeTruthy();
    expect(r.success).toBeUndefined();
  });

  it("erro quando update não afeta linha (cliente inativo ou já na grade)", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "fast_midia" });
    mockClientsUpdate({ data: [], error: null });
    const r = await addClienteStoriesAction(fd({ client_id: CID, quantidade_diaria: "3" }));
    expect(r.error).toBe("Cliente não encontrado, inativo ou já na grade");
  });
});

describe("updateClienteDiariaStoriesAction", () => {
  it("atualiza só a diária", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "fast_midia" });
    const { update } = mockClientsUpdate({ data: [{ id: CID }], error: null });
    const r = await updateClienteDiariaStoriesAction(fd({ client_id: CID, quantidade_diaria: "5" }));
    expect(r.success).toBe(true);
    expect(update).toHaveBeenCalledWith({ quantidade_diaria_stories: 5 });
  });

  it("erro quando cliente não está na grade", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "fast_midia" });
    mockClientsUpdate({ data: [], error: null });
    const r = await updateClienteDiariaStoriesAction(fd({ client_id: CID, quantidade_diaria: "5" }));
    expect(r.error).toBe("Cliente não está na grade");
  });
});

describe("removeClienteStoriesAction", () => {
  it("desliga tem_stories", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "fast_midia" });
    const { update } = mockClientsUpdate({ data: [{ id: CID }], error: null });
    const r = await removeClienteStoriesAction(fd({ client_id: CID }));
    expect(r.success).toBe(true);
    expect(update).toHaveBeenCalledWith({ tem_stories: false });
  });

  it("bloqueia role sem permissão", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "assessor" });
    mockClientsUpdate({ data: [{ id: CID }], error: null });
    const r = await removeClienteStoriesAction(fd({ client_id: CID }));
    expect(r.error).toBe("Sem permissão");
  });
});
