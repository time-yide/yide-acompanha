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

function setupMocks(
  taskData: ReturnType<typeof mockTaskRow>,
  options: { updateError?: { message: string } | null; assigneeRole?: string } = {},
) {
  const { updateError = null, assigneeRole = "assessor" } = options;
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
    if (table === "profiles") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { role: assigneeRole } }),
          }),
        }),
      };
    }
    return {};
  });
  return { update, updateEq };
}

describe("toggleTaskCompletionAction — roles que entregam (designer/editor/videomaker/audiovisual_chefe)", () => {
  it("designer fechando recebe erro pedindo uso do modal de entrega", async () => {
    requireAuthMock.mockResolvedValue({ id: "user-1", role: "designer", nome: "Designer Teste" });
    const { update } = setupMocks(mockTaskRow({ status: "aberta" }), { assigneeRole: "designer" });

    const result = await toggleTaskCompletionAction("task-1");

    expect(result?.error).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("editor fechando recebe erro pedindo uso do modal de entrega", async () => {
    requireAuthMock.mockResolvedValue({ id: "user-1", role: "editor", nome: "Editor Teste" });
    const { update } = setupMocks(mockTaskRow({ status: "aberta" }), { assigneeRole: "editor" });

    const result = await toggleTaskCompletionAction("task-1");

    expect(result?.error).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });

  it("designer reabrindo (status concluida -> aberta) NÃO bate no guard", async () => {
    requireAuthMock.mockResolvedValue({ id: "user-1", role: "designer", nome: "Designer Teste" });
    const { update } = setupMocks(
      mockTaskRow({ status: "concluida", artes_entregues: 3 }),
      { assigneeRole: "designer" },
    );

    await toggleTaskCompletionAction("task-1");

    expect(update).toHaveBeenCalled();
    const updateArg = update.mock.calls[0][0];
    expect(updateArg.status).toBe("aberta");
    expect(updateArg).not.toHaveProperty("artes_entregues");
  });
});

describe("toggleTaskCompletionAction — roles que NÃO entregam", () => {
  it("assessor fechando grava status=concluida sem artes_entregues", async () => {
    requireAuthMock.mockResolvedValue({ id: "user-1", role: "assessor", nome: "Assessor Teste" });
    const { update } = setupMocks(mockTaskRow({ status: "aberta" }), { assigneeRole: "assessor" });

    await toggleTaskCompletionAction("task-1");

    expect(update).toHaveBeenCalled();
    const updateArg = update.mock.calls[0][0];
    expect(updateArg.status).toBe("concluida");
    expect(updateArg).not.toHaveProperty("artes_entregues");
  });
});
