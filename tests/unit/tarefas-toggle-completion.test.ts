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

function mockTaskRow(overrides: Partial<{ status: string; criado_por: string; atribuido_a: string; completed_at: string | null; artes_entregues: number | null; titulo: string; client_id: string | null; tipo: string; drive_link: string | null }>) {
  return {
    id: "task-1",
    titulo: "Tarefa de teste",
    status: "aberta",
    criado_por: "user-1",
    atribuido_a: "user-1",
    completed_at: null,
    artes_entregues: null,
    client_id: null,
    // Default "geral": NÃO exige modal de entrega (só video/arte exigem).
    tipo: "geral",
    // Sem link por padrão (tarefa que ainda não passou pela entrega).
    drive_link: null,
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

// Helper: extrai o sinal requiresDelivery do retorno (ou undefined).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deliveryOf(result: any) {
  return result && "requiresDelivery" in result ? result.requiresDelivery : undefined;
}

describe("toggleTaskCompletionAction — roles que entregam (designer/editor/videomaker/audiovisual_chefe)", () => {
  it("designer fechando recebe sinal pra abrir o modal de entrega", async () => {
    requireAuthMock.mockResolvedValue({ id: "user-1", role: "designer", nome: "Designer Teste" });
    const { update } = setupMocks(mockTaskRow({ status: "aberta", tipo: "video" }), { assigneeRole: "designer" });

    const result = await toggleTaskCompletionAction("task-1");

    expect(deliveryOf(result)).toBeTruthy();
    expect(deliveryOf(result).toStatus).toBe("concluida");
    expect(update).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("editor fechando recebe sinal pra abrir o modal de entrega", async () => {
    requireAuthMock.mockResolvedValue({ id: "user-1", role: "editor", nome: "Editor Teste" });
    const { update } = setupMocks(mockTaskRow({ status: "aberta", tipo: "video" }), { assigneeRole: "editor" });

    const result = await toggleTaskCompletionAction("task-1");

    expect(deliveryOf(result)).toBeTruthy();
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

describe("toggleTaskCompletionAction — semântica de Postado/Entregue", () => {
  // Toggle de "checar" agora vai direto pra "postada" (Postado/Entregue),
  // não mais "concluida". Re-abertura aceita ambos os estados terminais.
  it("role que NÃO entrega fechando vai pra status=postada (não concluida)", async () => {
    requireAuthMock.mockResolvedValue({ id: "user-1", role: "adm", nome: "Adm Teste" });
    const { update } = setupMocks(mockTaskRow({ status: "aberta" }), { assigneeRole: "adm" });

    await toggleTaskCompletionAction("task-1");

    expect(update).toHaveBeenCalled();
    const updateArg = update.mock.calls[0][0];
    expect(updateArg.status).toBe("postada");
    expect(updateArg.completed_at).toBeTruthy();
  });

  it("reabrir task que está em 'postada' volta pra 'aberta'", async () => {
    requireAuthMock.mockResolvedValue({ id: "user-1", role: "adm", nome: "Adm Teste" });
    const { update } = setupMocks(mockTaskRow({ status: "postada" }), { assigneeRole: "adm" });

    await toggleTaskCompletionAction("task-1");

    expect(update).toHaveBeenCalled();
    const updateArg = update.mock.calls[0][0];
    expect(updateArg.status).toBe("aberta");
    expect(updateArg.completed_at).toBeNull();
  });

  it("reabrir task que está em 'concluida' (operacional antigo) também volta pra 'aberta'", async () => {
    // Backwards compat: tasks que ficaram em 'concluida' antes da mudança
    // semântica ainda podem ser reabertas pelo toggle.
    requireAuthMock.mockResolvedValue({ id: "user-1", role: "adm", nome: "Adm Teste" });
    const { update } = setupMocks(mockTaskRow({ status: "concluida" }), { assigneeRole: "adm" });

    await toggleTaskCompletionAction("task-1");

    expect(update).toHaveBeenCalled();
    const updateArg = update.mock.calls[0][0];
    expect(updateArg.status).toBe("aberta");
  });
});

describe("toggleTaskCompletionAction — assessor/coord também entregam", () => {
  // ROLES_QUE_ENTREGAM inclui assessor; em video/arte o modal se aplica a ele.
  it("assessor fechando tarefa de entrega (video/arte) recebe sinal pra abrir modal", async () => {
    requireAuthMock.mockResolvedValue({ id: "user-1", role: "assessor", nome: "Assessor Teste" });
    const { update } = setupMocks(mockTaskRow({ status: "aberta", tipo: "video" }), { assigneeRole: "assessor" });

    const result = await toggleTaskCompletionAction("task-1");

    expect(deliveryOf(result)).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });

  it("assessor fechando tarefa GERAL (sem entrega) conclui direto, sem modal", async () => {
    // Assessor NÃO está em ROLES_ENTREGA_SEMPRE: suas tarefas "geral"
    // (reunião/follow-up) não têm material, então conclui pelo checkbox.
    requireAuthMock.mockResolvedValue({ id: "user-1", role: "assessor", nome: "Assessor Teste" });
    const { update } = setupMocks(mockTaskRow({ status: "aberta", tipo: "geral" }), { assigneeRole: "assessor" });

    const result = await toggleTaskCompletionAction("task-1");

    expect(deliveryOf(result)).toBeUndefined();
    expect(result?.error).toBeUndefined();
    expect(update).toHaveBeenCalled();
    expect(update.mock.calls[0][0].status).toBe("postada");
  });

  it("tarefa vídeo/arte que JÁ tem drive_link vai pra postada sem re-pedir link", async () => {
    // Bug: link é pra ENTRAR no concluído operacional/aprovação. Se a tarefa já
    // passou pela entrega (tem drive_link), marcar Postado/Entregue não deve
    // re-pedir. Antes o checkbox ignorava o drive_link e abria o modal de novo.
    requireAuthMock.mockResolvedValue({ id: "user-1", role: "assessor", nome: "Assessor Teste" });
    const { update } = setupMocks(
      mockTaskRow({ status: "aprovada", tipo: "video", drive_link: "https://drive.google.com/abc" }),
      { assigneeRole: "assessor" },
    );

    const result = await toggleTaskCompletionAction("task-1");

    expect(deliveryOf(result)).toBeUndefined();
    expect(result?.error).toBeUndefined();
    expect(update).toHaveBeenCalled();
    expect(update.mock.calls[0][0].status).toBe("postada");
  });
});

describe("toggleTaskCompletionAction — audiovisual de execução entrega em QUALQUER tipo", () => {
  // ROLES_ENTREGA_SEMPRE (editor/videomaker/designer/audiovisual_chefe/
  // coordenador): link obrigatório inclusive em tarefa "geral".
  it("editor fechando tarefa GERAL agora abre o modal de entrega", async () => {
    requireAuthMock.mockResolvedValue({ id: "user-1", role: "editor", nome: "Editor Teste" });
    const { update } = setupMocks(mockTaskRow({ status: "aberta", tipo: "geral" }), { assigneeRole: "editor" });

    const result = await toggleTaskCompletionAction("task-1");

    expect(deliveryOf(result)).toBeTruthy();
    expect(deliveryOf(result).tipo).toBe("geral");
    expect(update).not.toHaveBeenCalled();
  });

  it("coordenador fechando tarefa GERAL agora abre o modal de entrega", async () => {
    requireAuthMock.mockResolvedValue({ id: "user-1", role: "coordenador", nome: "Coord Teste" });
    const { update } = setupMocks(mockTaskRow({ status: "aberta", tipo: "geral" }), { assigneeRole: "coordenador" });

    const result = await toggleTaskCompletionAction("task-1");

    expect(deliveryOf(result)).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });
});
