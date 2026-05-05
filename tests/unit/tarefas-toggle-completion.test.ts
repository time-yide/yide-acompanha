import { describe, it, expect, vi, beforeEach } from "vitest";

const fromCookieMock = vi.hoisted(() => vi.fn());
const requireAuthMock = vi.hoisted(() => vi.fn());
const logAuditMock = vi.hoisted(() => vi.fn());
const dispatchNotificationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromCookieMock }),
}));

vi.mock("@/lib/auth/session", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/lib/audit/log", () => ({
  logAudit: logAuditMock,
}));

vi.mock("@/lib/notificacoes/dispatch", () => ({
  dispatchNotification: dispatchNotificationMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { toggleTaskCompletionAction } from "@/lib/tarefas/actions";

beforeEach(() => {
  fromCookieMock.mockReset();
  requireAuthMock.mockReset();
  logAuditMock.mockReset();
  dispatchNotificationMock.mockReset();
});

function mockTaskRow(overrides: Partial<{ status: string; criado_por: string; atribuido_a: string; completed_at: string | null; artes_entregues: number | null; titulo: string; client_id: string | null }>) {
  return {
    id: "task-1",
    titulo: "Tarefa de teste",
    status: "aberta",
    criado_por: "user-1",
    atribuido_a: "user-1",
    completed_at: null,
    artes_entregues: null,
    client_id: null,
    ...overrides,
  };
}

function setupMocks(taskData: ReturnType<typeof mockTaskRow>, updateError: { message: string } | null = null) {
  const updateEq = vi.fn().mockResolvedValue({ error: updateError });
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  fromCookieMock.mockImplementation((table: string) => {
    if (table === "tasks") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: taskData }),
          }),
        }),
        update,
      };
    }
    return {};
  });
  return { update, updateEq };
}

describe("toggleTaskCompletionAction — designer flow", () => {
  it("designer fechando sem artesEntregues retorna requiresArtesPrompt sem mutar", async () => {
    requireAuthMock.mockResolvedValue({ id: "user-1", role: "designer", nome: "Designer Teste" });
    const { update } = setupMocks(mockTaskRow({ status: "aberta" }));

    const result = await toggleTaskCompletionAction("task-1");

    expect(result).toEqual({ requiresArtesPrompt: true });
    expect(update).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("designer fechando com artesEntregues=5 grava status=concluida e artes_entregues=5", async () => {
    requireAuthMock.mockResolvedValue({ id: "user-1", role: "designer", nome: "Designer Teste" });
    const { update } = setupMocks(mockTaskRow({ status: "aberta" }));

    await toggleTaskCompletionAction("task-1", 5);

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: "concluida",
      artes_entregues: 5,
    }));
  });

  it("designer fechando com artesEntregues=0 grava (0 é válido)", async () => {
    requireAuthMock.mockResolvedValue({ id: "user-1", role: "designer", nome: "Designer Teste" });
    const { update } = setupMocks(mockTaskRow({ status: "aberta" }));

    await toggleTaskCompletionAction("task-1", 0);

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: "concluida",
      artes_entregues: 0,
    }));
  });

  it("designer com artesEntregues negativo retorna erro", async () => {
    requireAuthMock.mockResolvedValue({ id: "user-1", role: "designer", nome: "Designer Teste" });
    setupMocks(mockTaskRow({ status: "aberta" }));

    const result = await toggleTaskCompletionAction("task-1", -1);

    expect(result?.error).toBeTruthy();
  });

  it("designer reabrindo NÃO pede prompt e mantém artes_entregues (não envia campo)", async () => {
    requireAuthMock.mockResolvedValue({ id: "user-1", role: "designer", nome: "Designer Teste" });
    const { update } = setupMocks(mockTaskRow({ status: "concluida", artes_entregues: 3 }));

    await toggleTaskCompletionAction("task-1");

    expect(update).toHaveBeenCalled();
    const updateArg = update.mock.calls[0][0];
    expect(updateArg.status).toBe("aberta");
    expect(updateArg).not.toHaveProperty("artes_entregues");
  });
});

describe("toggleTaskCompletionAction — outros roles", () => {
  it("assessor fechando NÃO pede prompt e grava sem artes_entregues", async () => {
    requireAuthMock.mockResolvedValue({ id: "user-1", role: "assessor", nome: "Assessor Teste" });
    const { update } = setupMocks(mockTaskRow({ status: "aberta" }));

    await toggleTaskCompletionAction("task-1");

    expect(update).toHaveBeenCalled();
    const updateArg = update.mock.calls[0][0];
    expect(updateArg.status).toBe("concluida");
    expect(updateArg).not.toHaveProperty("artes_entregues");
  });
});
