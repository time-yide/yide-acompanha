import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAuthMock = vi.hoisted(() => vi.fn());
const updateUserByIdMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({
    auth: { admin: { updateUserById: updateUserByIdMock } },
    from: fromMock,
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromMock }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { resetColaboradorPasswordAction } from "@/lib/colaboradores/actions";

const VALID_UUID = "11111111-1111-1111-1111-111111111111";
const ACTOR_UUID = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
  requireAuthMock.mockReset();
  updateUserByIdMock.mockReset();
  fromMock.mockReset();
  // Default: ator é sócio com permissão.
  requireAuthMock.mockResolvedValue({
    id: ACTOR_UUID,
    role: "socio",
    nome: "Dono",
    email: "socio@x.com",
    ativo: true,
  });
  // audit_log insert no-op por padrão
  fromMock.mockImplementation(() => ({ insert: vi.fn().mockResolvedValue({ error: null }) }));
});

describe("resetColaboradorPasswordAction — validação", () => {
  it("retorna erro de permissão se ator não tem manage:users", async () => {
    requireAuthMock.mockResolvedValueOnce({
      id: ACTOR_UUID,
      role: "assessor",
      nome: "Maria",
      email: "m@x.com",
      ativo: true,
    });
    const fd = new FormData();
    fd.set("user_id", VALID_UUID);
    const r = await resetColaboradorPasswordAction(fd);
    expect(r).toEqual({ error: "Sem permissão" });
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it("retorna erro se user_id está ausente", async () => {
    const fd = new FormData();
    const r = await resetColaboradorPasswordAction(fd);
    expect(r).toEqual({ error: "ID inválido" });
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it("retorna erro se user_id é string vazia", async () => {
    const fd = new FormData();
    fd.set("user_id", "");
    const r = await resetColaboradorPasswordAction(fd);
    expect(r).toEqual({ error: "ID inválido" });
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it("retorna erro se user_id não é UUID", async () => {
    const fd = new FormData();
    fd.set("user_id", "not-a-uuid");
    const r = await resetColaboradorPasswordAction(fd);
    expect(r).toEqual({ error: "ID inválido" });
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it("bloqueia auto-reset (actor.id === userId) com mensagem específica", async () => {
    const fd = new FormData();
    fd.set("user_id", ACTOR_UUID);
    const r = await resetColaboradorPasswordAction(fd);
    expect(r).toEqual({
      error: "Use a página de configurações para trocar sua própria senha",
    });
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it("retorna erro se updateUserById falha", async () => {
    updateUserByIdMock.mockResolvedValueOnce({ error: { message: "boom" } });
    const fd = new FormData();
    fd.set("user_id", VALID_UUID);
    const r = await resetColaboradorPasswordAction(fd);
    expect(r).toEqual({ error: "Falha ao resetar senha" });
  });

  it("sucesso: gera senha, chama updateUserById e retorna a senha (sem expor no audit)", async () => {
    updateUserByIdMock.mockResolvedValueOnce({ error: null });
    const auditInsert = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === "audit_log") return { insert: auditInsert };
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });

    const fd = new FormData();
    fd.set("user_id", VALID_UUID);
    const r = await resetColaboradorPasswordAction(fd);

    expect(r).toEqual(expect.objectContaining({ success: true }));
    if ("success" in r) {
      expect(typeof r.password).toBe("string");
      expect(r.password.length).toBeGreaterThanOrEqual(12);
      expect(updateUserByIdMock).toHaveBeenCalledWith(
        VALID_UUID,
        expect.objectContaining({ password: r.password }),
      );

      // Audit log NÃO deve conter a senha em texto.
      expect(auditInsert).toHaveBeenCalledTimes(1);
      const auditPayload = auditInsert.mock.calls[0][0];
      const serialized = JSON.stringify(auditPayload);
      expect(serialized).not.toContain(r.password);
      expect(auditPayload).toEqual(
        expect.objectContaining({
          entidade: "profiles",
          entidade_id: VALID_UUID,
          acao: "update",
          ator_id: ACTOR_UUID,
          justificativa: "Reset de senha solicitado pelo sócio/ADM",
          dados_depois: { senha_resetada: true },
        }),
      );
    }
  });
});
