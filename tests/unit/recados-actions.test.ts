import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAuthMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());
const serviceFromMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());
const dispatchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromMock }),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: serviceFromMock, rpc: rpcMock }),
}));

vi.mock("@/lib/notificacoes/dispatch", () => ({
  dispatchNotification: dispatchMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  criarRecadoAction,
  editarRecadoAction,
  apagarRecadoAction,
  fixarRecadoAction,
  reagirRecadoAction,
} from "@/lib/recados/actions";

const ACTOR_SOCIO = { id: "11111111-1111-1111-1111-111111111111", role: "socio" as const, nome: "Socio", email: "s@x.com", ativo: true, avatarUrl: null };
const ACTOR_ASSESSOR = { id: "22222222-2222-2222-2222-222222222222", role: "assessor" as const, nome: "Assessor", email: "a@x.com", ativo: true, avatarUrl: null };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("criarRecadoAction", () => {
  it("rejeita assessor tentando fixar permanente", async () => {
    requireAuthMock.mockResolvedValue(ACTOR_ASSESSOR);
    const fd = new FormData();
    fd.set("titulo", "ok");
    fd.set("corpo", "ok");
    fd.set("notif_scope", "todos");
    fd.set("permanente", "on");

    const result = await criarRecadoAction(fd);
    expect(result).toEqual({ error: "Apenas Sócio pode fixar recados como permanentes" });
  });

  it("rejeita título vazio", async () => {
    requireAuthMock.mockResolvedValue(ACTOR_ASSESSOR);
    const fd = new FormData();
    fd.set("titulo", "");
    fd.set("corpo", "ok");
    fd.set("notif_scope", "nenhum");
    const result = await criarRecadoAction(fd);
    expect(result).toHaveProperty("error");
  });

  it("não chama dispatchNotification quando notif_scope=nenhum", async () => {
    requireAuthMock.mockResolvedValue(ACTOR_ASSESSOR);
    fromMock.mockReturnValue({
      insert: () => ({ select: () => ({ single: async () => ({ data: { id: "r1", titulo: "ok" }, error: null }) }) }),
    });

    const fd = new FormData();
    fd.set("titulo", "ok");
    fd.set("corpo", "ok");
    fd.set("notif_scope", "nenhum");

    const result = await criarRecadoAction(fd);
    expect(result).toEqual({ success: true, id: "r1" });
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("permite sócio criar recado permanente e captura permanente=true no insert", async () => {
    requireAuthMock.mockResolvedValue(ACTOR_SOCIO);
    const insertCapture = vi.fn((_payload: Record<string, unknown>) => ({
      select: () => ({ single: async () => ({ data: { id: "r2", titulo: "ok" }, error: null }) }),
    }));
    fromMock.mockReturnValue({ insert: insertCapture });

    const fd = new FormData();
    fd.set("titulo", "ok");
    fd.set("corpo", "ok");
    fd.set("notif_scope", "nenhum");
    fd.set("permanente", "on");

    const result = await criarRecadoAction(fd);
    expect(result).toEqual({ success: true, id: "r2" });
    expect(insertCapture).toHaveBeenCalledOnce();
    expect(insertCapture.mock.calls[0][0]).toMatchObject({
      autor_id: ACTOR_SOCIO.id,
      autor_role_snapshot: "socio",
      permanente: true,
    });
  });

  it("dispatcha com payload correto quando notif_scope=todos", async () => {
    requireAuthMock.mockResolvedValue(ACTOR_SOCIO);
    fromMock.mockReturnValue({
      insert: () => ({ select: () => ({ single: async () => ({ data: { id: "r3", titulo: "Aviso geral" }, error: null }) }) }),
    });
    serviceFromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          neq: async () => ({
            data: [{ id: "u1" }, { id: "u2" }],
            error: null,
          }),
        }),
      }),
    });

    const fd = new FormData();
    fd.set("titulo", "Aviso geral");
    fd.set("corpo", "Atenção");
    fd.set("notif_scope", "todos");

    const result = await criarRecadoAction(fd);
    expect(result).toEqual({ success: true, id: "r3" });
    expect(dispatchMock).toHaveBeenCalledOnce();
    expect(dispatchMock.mock.calls[0][0]).toMatchObject({
      evento_tipo: "recado_novo",
      titulo: `Novo recado de ${ACTOR_SOCIO.nome}`,
      mensagem: "Aviso geral",
      link: "/recados#r3",
      user_ids_extras: ["u1", "u2"],
      source_user_id: ACTOR_SOCIO.id,
    });
  });
});

describe("editarRecadoAction", () => {
  it("não chama dispatchNotification ao editar", async () => {
    requireAuthMock.mockResolvedValue(ACTOR_ASSESSOR);
    fromMock.mockReturnValue({
      select: () => ({ eq: () => ({ single: async () => ({ data: { autor_id: ACTOR_ASSESSOR.id }, error: null }) }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    });

    const fd = new FormData();
    fd.set("id", "33333333-3333-4333-9333-333333333333");
    fd.set("titulo", "novo título");
    fd.set("corpo", "novo corpo");

    const result = await editarRecadoAction(fd);
    expect(result).toEqual({ success: true });
    expect(dispatchMock).not.toHaveBeenCalled();
  });
});

describe("apagarRecadoAction", () => {
  it("rejeita não-autor não-privilegiado", async () => {
    requireAuthMock.mockResolvedValue(ACTOR_ASSESSOR);
    fromMock.mockReturnValue({
      select: () => ({ eq: () => ({ single: async () => ({ data: { autor_id: "otherone" }, error: null }) }) }),
    });

    const result = await apagarRecadoAction("r1");
    expect(result).toEqual({ error: "Sem permissão" });
  });

  it("permite sócio apagar de outro autor", async () => {
    requireAuthMock.mockResolvedValue(ACTOR_SOCIO);
    fromMock.mockReturnValue({
      select: () => ({ eq: () => ({ single: async () => ({ data: { autor_id: "outro" }, error: null }) }) }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    });

    const result = await apagarRecadoAction("r1");
    expect(result).toEqual({ success: true });
  });
});

describe("fixarRecadoAction", () => {
  it("rejeita não-sócio", async () => {
    requireAuthMock.mockResolvedValue(ACTOR_ASSESSOR);
    const result = await fixarRecadoAction("r1", true);
    expect(result).toEqual({ error: "Apenas Sócio pode fixar recados" });
  });

  it("retorna erro 'não encontrado' quando id não existe", async () => {
    requireAuthMock.mockResolvedValue(ACTOR_SOCIO);
    fromMock.mockReturnValue({
      update: () => ({
        eq: () => ({
          select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        }),
      }),
    });

    const result = await fixarRecadoAction("nao-existe", true);
    expect(result).toEqual({ error: "Recado não encontrado" });
  });
});

describe("reagirRecadoAction", () => {
  it("rejeita emoji fora da paleta", async () => {
    requireAuthMock.mockResolvedValue(ACTOR_ASSESSOR);
    const result = await reagirRecadoAction("r1", "🤡");
    expect(result).toEqual({ error: "Emoji inválido" });
  });
});
