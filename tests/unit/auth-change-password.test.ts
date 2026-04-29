import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAuthMock = vi.hoisted(() => vi.fn());
const getUserMock = vi.hoisted(() => vi.fn());
const signInWithPasswordMock = vi.hoisted(() => vi.fn());
const updateUserMock = vi.hoisted(() => vi.fn());
const logAuditMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: getUserMock,
      signInWithPassword: signInWithPasswordMock,
      updateUser: updateUserMock,
    },
    from: fromMock,
  }),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: () => ({ insert: async () => ({ error: null }) }) }),
}));

vi.mock("@/lib/audit/log", () => ({
  logAudit: logAuditMock,
}));

vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_APP_URL: "http://localhost:3000" },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { changeOwnPasswordAction } from "@/lib/auth/actions";
import { changePasswordSchema } from "@/lib/auth/schemas";

describe("changePasswordSchema", () => {
  it("rejeita quando newPassword não bate com confirmPassword", () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: "senhaAtual123",
      newPassword: "novaSenha123",
      confirmPassword: "outraSenha123",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msg = r.error.issues.find((i) => i.path[0] === "confirmPassword")?.message;
      expect(msg).toBe("Confirmação não bate com a nova senha");
    }
  });

  it("rejeita quando newPassword é igual à currentPassword", () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: "mesmaSenha123",
      newPassword: "mesmaSenha123",
      confirmPassword: "mesmaSenha123",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msg = r.error.issues.find((i) => i.path[0] === "newPassword")?.message;
      expect(msg).toBe("Nova senha precisa ser diferente da atual");
    }
  });

  it("rejeita newPassword com menos de 8 caracteres", () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: "senhaAtual123",
      newPassword: "curta",
      confirmPassword: "curta",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msg = r.error.issues.find((i) => i.path[0] === "newPassword")?.message;
      expect(msg).toBe("Nova senha precisa ter ao menos 8 caracteres");
    }
  });

  it("rejeita currentPassword vazia", () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: "",
      newPassword: "novaSenha123",
      confirmPassword: "novaSenha123",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msg = r.error.issues.find((i) => i.path[0] === "currentPassword")?.message;
      expect(msg).toBe("Senha atual obrigatória");
    }
  });

  it("aceita um caso válido", () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: "senhaAtual123",
      newPassword: "novaSenha123",
      confirmPassword: "novaSenha123",
    });
    expect(r.success).toBe(true);
  });
});

const ACTOR_UUID = "33333333-3333-3333-3333-333333333333";

describe("changeOwnPasswordAction", () => {
  beforeEach(() => {
    requireAuthMock.mockReset();
    getUserMock.mockReset();
    signInWithPasswordMock.mockReset();
    updateUserMock.mockReset();
    logAuditMock.mockReset();
    fromMock.mockReset();

    requireAuthMock.mockResolvedValue({
      id: ACTOR_UUID,
      role: "assessor",
      nome: "Fulana",
      email: "stale@profile.com",
      ativo: true,
    });
    getUserMock.mockResolvedValue({ data: { user: { email: "u@x.com" } } });
    signInWithPasswordMock.mockResolvedValue({ error: null });
    updateUserMock.mockResolvedValue({ error: null });
    logAuditMock.mockResolvedValue(undefined);
    fromMock.mockImplementation(() => ({ insert: vi.fn().mockResolvedValue({ error: null }) }));
  });

  it("sucesso: retorna {success:true} e audita sem expor a senha", async () => {
    const fd = new FormData();
    fd.set("currentPassword", "oldpassword12");
    fd.set("newPassword", "brandnewpass34");
    fd.set("confirmPassword", "brandnewpass34");

    const r = await changeOwnPasswordAction(fd);

    expect(r).toEqual({ success: true });
    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: "u@x.com",
      password: "oldpassword12",
    });
    expect(updateUserMock).toHaveBeenCalledWith({ password: "brandnewpass34" });

    expect(logAuditMock).toHaveBeenCalledTimes(1);
    const auditPayload = logAuditMock.mock.calls[0][0];
    expect(auditPayload).toEqual(
      expect.objectContaining({
        entidade: "profiles",
        entidade_id: ACTOR_UUID,
        acao: "update",
        ator_id: ACTOR_UUID,
        dados_depois: { senha_alterada_pelo_proprio_usuario: true },
      }),
    );
    const serialized = JSON.stringify(auditPayload);
    expect(serialized).not.toContain("oldpassword12");
    expect(serialized).not.toContain("brandnewpass34");
  });

  it("usa o email de auth.getUser(), não o email do profile (evita drift)", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { email: "fresh@auth.com" } } });
    const fd = new FormData();
    fd.set("currentPassword", "oldpassword12");
    fd.set("newPassword", "brandnewpass34");
    fd.set("confirmPassword", "brandnewpass34");

    const r = await changeOwnPasswordAction(fd);

    expect(r).toEqual({ success: true });
    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: "fresh@auth.com",
      password: "oldpassword12",
    });
  });

  it("retorna 'Sessão inválida' se auth.getUser não devolve email", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } });
    const fd = new FormData();
    fd.set("currentPassword", "oldpassword12");
    fd.set("newPassword", "brandnewpass34");
    fd.set("confirmPassword", "brandnewpass34");

    const r = await changeOwnPasswordAction(fd);

    expect(r).toEqual({ error: "Sessão inválida" });
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
    expect(updateUserMock).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("senha atual errada (status 400) retorna 'Senha atual incorreta'", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({
      error: { status: 400, message: "Invalid login credentials" },
    });
    const fd = new FormData();
    fd.set("currentPassword", "oldpassword12");
    fd.set("newPassword", "brandnewpass34");
    fd.set("confirmPassword", "brandnewpass34");

    const r = await changeOwnPasswordAction(fd);

    expect(r).toEqual({ error: "Senha atual incorreta" });
    expect(updateUserMock).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("erro de serviço (status 500) retorna mensagem genérica", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({
      error: { status: 500, message: "Service unavailable" },
    });
    const fd = new FormData();
    fd.set("currentPassword", "oldpassword12");
    fd.set("newPassword", "brandnewpass34");
    fd.set("confirmPassword", "brandnewpass34");

    const r = await changeOwnPasswordAction(fd);

    expect(r).toEqual({
      error: "Não foi possível verificar sua senha atual. Tente novamente em instantes.",
    });
    expect(updateUserMock).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("validação de schema: confirmPassword diferente devolve a primeira mensagem", async () => {
    const fd = new FormData();
    fd.set("currentPassword", "oldpassword12");
    fd.set("newPassword", "brandnewpass34");
    fd.set("confirmPassword", "outrasenha9999");

    const r = await changeOwnPasswordAction(fd);

    expect(r).toEqual({ error: "Confirmação não bate com a nova senha" });
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
    expect(updateUserMock).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
  });
});
