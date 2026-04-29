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

import {
  resetColaboradorPasswordAction,
  toggleColaboradorAtivoAction,
} from "@/lib/colaboradores/actions";

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

describe("toggleColaboradorAtivoAction", () => {
  // Helper: monta o mock do supabase para o action — controla o `before.ativo`
  // que a query `.select("ativo").eq().single()` retorna, captura o update e
  // captura o insert no audit_log.
  function setupSupabaseMock(opts: {
    beforeAtivo: boolean | null; // null = profile não encontrado
    updateError?: { message: string } | null;
  }) {
    const updateEq = vi.fn().mockResolvedValue({ error: opts.updateError ?? null });
    const update = vi.fn(() => ({ eq: updateEq }));
    const auditInsert = vi.fn().mockResolvedValue({ error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === "audit_log") {
        return { insert: auditInsert };
      }
      // table === "profiles"
      return {
        select: () => ({
          eq: () => ({
            single: vi.fn().mockResolvedValue({
              data: opts.beforeAtivo === null ? null : { ativo: opts.beforeAtivo },
              error: opts.beforeAtivo === null ? { message: "not found" } : null,
            }),
          }),
        }),
        update,
      };
    });

    return { update, updateEq, auditInsert };
  }

  it("retorna erro de permissão se ator não tem edit:colaboradores", async () => {
    requireAuthMock.mockResolvedValueOnce({
      id: ACTOR_UUID,
      role: "assessor",
      nome: "Maria",
      email: "m@x.com",
      ativo: true,
    });
    const fd = new FormData();
    fd.set("user_id", VALID_UUID);
    fd.set("ativo", "false");
    const r = await toggleColaboradorAtivoAction(fd);
    expect(r).toEqual({ error: "Sem permissão" });
  });

  it("retorna erro se user_id está ausente", async () => {
    const fd = new FormData();
    fd.set("ativo", "false");
    const r = await toggleColaboradorAtivoAction(fd);
    expect(r).toEqual({ error: "ID inválido" });
  });

  it("retorna erro se user_id é inválido (não-UUID)", async () => {
    const fd = new FormData();
    fd.set("user_id", "not-a-uuid");
    fd.set("ativo", "false");
    const r = await toggleColaboradorAtivoAction(fd);
    expect(r).toEqual({ error: "ID inválido" });
  });

  it("bloqueia self-archive (actor.id === userId)", async () => {
    const fd = new FormData();
    fd.set("user_id", ACTOR_UUID);
    fd.set("ativo", "false");
    const r = await toggleColaboradorAtivoAction(fd);
    expect(r).toEqual({ error: "Você não pode arquivar a si mesmo" });
  });

  it("retorna erro se profile não existe", async () => {
    setupSupabaseMock({ beforeAtivo: null });
    const fd = new FormData();
    fd.set("user_id", VALID_UUID);
    fd.set("ativo", "false");
    const r = await toggleColaboradorAtivoAction(fd);
    expect(r).toEqual({ error: "Colaborador não encontrado" });
  });

  it("idempotente: se já está no estado-alvo, retorna sucesso sem update nem audit", async () => {
    const { update, auditInsert } = setupSupabaseMock({ beforeAtivo: false });
    const fd = new FormData();
    fd.set("user_id", VALID_UUID);
    fd.set("ativo", "false"); // já inativo
    const r = await toggleColaboradorAtivoAction(fd);
    expect(r).toEqual({ success: true, ativo: false });
    expect(update).not.toHaveBeenCalled();
    expect(auditInsert).not.toHaveBeenCalled();
  });

  it("sucesso: arquivar — update ativo=false, audit com justificativa correta", async () => {
    const { update, updateEq, auditInsert } = setupSupabaseMock({ beforeAtivo: true });
    const fd = new FormData();
    fd.set("user_id", VALID_UUID);
    fd.set("ativo", "false");
    const r = await toggleColaboradorAtivoAction(fd);

    expect(r).toEqual({ success: true, ativo: false });
    expect(update).toHaveBeenCalledWith({ ativo: false });
    expect(updateEq).toHaveBeenCalledWith("id", VALID_UUID);

    expect(auditInsert).toHaveBeenCalledTimes(1);
    expect(auditInsert.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        entidade: "profiles",
        entidade_id: VALID_UUID,
        acao: "update",
        ator_id: ACTOR_UUID,
        justificativa: "Colaborador arquivado",
        dados_antes: { ativo: true },
        dados_depois: { ativo: false },
      }),
    );
  });

  it("sucesso: desarquivar — update ativo=true, audit com justificativa correta", async () => {
    const { update, updateEq, auditInsert } = setupSupabaseMock({ beforeAtivo: false });
    const fd = new FormData();
    fd.set("user_id", VALID_UUID);
    fd.set("ativo", "true");
    const r = await toggleColaboradorAtivoAction(fd);

    expect(r).toEqual({ success: true, ativo: true });
    expect(update).toHaveBeenCalledWith({ ativo: true });
    expect(updateEq).toHaveBeenCalledWith("id", VALID_UUID);

    expect(auditInsert).toHaveBeenCalledTimes(1);
    expect(auditInsert.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        entidade: "profiles",
        entidade_id: VALID_UUID,
        acao: "update",
        ator_id: ACTOR_UUID,
        justificativa: "Colaborador desarquivado",
        dados_antes: { ativo: false },
        dados_depois: { ativo: true },
      }),
    );
  });

  it("retorna erro se update falha", async () => {
    setupSupabaseMock({ beforeAtivo: true, updateError: { message: "boom" } });
    const fd = new FormData();
    fd.set("user_id", VALID_UUID);
    fd.set("ativo", "false");
    const r = await toggleColaboradorAtivoAction(fd);
    expect(r).toEqual({ error: "Falha ao atualizar status" });
  });
});
