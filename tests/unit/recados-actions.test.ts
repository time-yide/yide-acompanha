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
});

describe("reagirRecadoAction", () => {
  it("rejeita emoji fora da paleta", async () => {
    requireAuthMock.mockResolvedValue(ACTOR_ASSESSOR);
    const result = await reagirRecadoAction("r1", "🤡");
    expect(result).toEqual({ error: "Emoji inválido" });
  });
});
