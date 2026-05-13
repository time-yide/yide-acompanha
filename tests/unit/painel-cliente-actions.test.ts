import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAuthMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());
const createUserMock = vi.hoisted(() => vi.fn());
const deleteUserMock = vi.hoisted(() => vi.fn());
const logAuditMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({
    from: fromMock,
    auth: { admin: { createUser: createUserMock, deleteUser: deleteUserMock } },
  }),
}));

vi.mock("@/lib/audit/log", () => ({
  logAudit: logAuditMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/password-generator", () => ({
  generateStrongPassword: () => "GeneratedPass!123",
}));

import { createClientPortalAccessAction } from "@/lib/painel-cliente/actions";

const CLIENT_UUID = "11111111-1111-1111-1111-111111111111";
const ACTOR_UUID = "22222222-2222-2222-2222-222222222222";

interface PortalRow {
  user_id: string;
  ativo: boolean;
}

/**
 * Configura `fromMock` pra simular as 3 queries que a action faz, na ordem:
 *  1. profiles (lookup de email colaborador interno)
 *  2. clients (existe + status)
 *  3. client_portal_users (count de ativos atuais)
 *  4. client_portal_users (insert do novo acesso)
 */
function setupFromMock(opts: {
  profileExists?: boolean;
  clientExists?: boolean;
  existingActivePortals: PortalRow[];
  insertError?: string | null;
}) {
  const calls: string[] = [];
  fromMock.mockImplementation((table: string) => {
    calls.push(table);
    if (table === "profiles") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: opts.profileExists ? { id: "x" } : null,
            }),
          }),
        }),
      };
    }
    if (table === "clients") {
      return {
        select: () => ({
          eq: () => ({
            single: vi.fn().mockResolvedValue({
              data: opts.clientExists !== false ? { id: CLIENT_UUID, status: "ativo" } : null,
            }),
          }),
        }),
      };
    }
    if (table === "client_portal_users") {
      // Distingue select (count) vs insert pela ordem da chamada
      const wasInserted = calls.filter((t) => t === "client_portal_users").length > 1;
      if (!wasInserted) {
        return {
          select: () => ({
            eq: () => ({
              eq: vi.fn().mockResolvedValue({
                data: opts.existingActivePortals,
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        insert: vi.fn().mockResolvedValue({
          error: opts.insertError ? { message: opts.insertError } : null,
        }),
      };
    }
    return {};
  });
}

function makeFormData(overrides: Partial<{ client_id: string; email: string; nome_contato: string }> = {}) {
  const fd = new FormData();
  fd.set("client_id", overrides.client_id ?? CLIENT_UUID);
  fd.set("email", overrides.email ?? "socio@empresa.com");
  fd.set("nome_contato", overrides.nome_contato ?? "Sócio Teste");
  return fd;
}

beforeEach(() => {
  requireAuthMock.mockReset();
  fromMock.mockReset();
  createUserMock.mockReset();
  deleteUserMock.mockReset();
  logAuditMock.mockReset();
  requireAuthMock.mockResolvedValue({
    id: ACTOR_UUID,
    role: "socio",
    nome: "Dono",
    email: "dono@yide.com",
    ativo: true,
  });
  createUserMock.mockResolvedValue({
    data: { user: { id: "new-user-id" } },
    error: null,
  });
  logAuditMock.mockResolvedValue(undefined);
});

describe("createClientPortalAccessAction — limite de 5 acessos ativos", () => {
  it("permite criar 1º acesso quando cliente não tem nenhum", async () => {
    setupFromMock({ existingActivePortals: [] });
    const r = await createClientPortalAccessAction(makeFormData());
    expect(r).toEqual({ success: true, password: "GeneratedPass!123" });
  });

  it("permite criar o 5º acesso quando cliente tem 4 ativos", async () => {
    setupFromMock({
      existingActivePortals: [
        { user_id: "u1", ativo: true },
        { user_id: "u2", ativo: true },
        { user_id: "u3", ativo: true },
        { user_id: "u4", ativo: true },
      ],
    });
    const r = await createClientPortalAccessAction(makeFormData());
    expect(r).toEqual({ success: true, password: "GeneratedPass!123" });
  });

  it("bloqueia 6º acesso quando cliente já tem 5 ativos", async () => {
    setupFromMock({
      existingActivePortals: [
        { user_id: "u1", ativo: true },
        { user_id: "u2", ativo: true },
        { user_id: "u3", ativo: true },
        { user_id: "u4", ativo: true },
        { user_id: "u5", ativo: true },
      ],
    });
    const r = await createClientPortalAccessAction(makeFormData());
    expect(r).toEqual({
      error: expect.stringContaining("Limite de 5 acessos ativos"),
    });
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("revogados não contam pro limite — permite criar quando tem 5 revogados + 0 ativos", async () => {
    setupFromMock({ existingActivePortals: [] });
    const r = await createClientPortalAccessAction(makeFormData());
    expect(r).toEqual({ success: true, password: "GeneratedPass!123" });
  });

  it("rejeita ator sem permissão (assessor)", async () => {
    requireAuthMock.mockResolvedValueOnce({
      id: ACTOR_UUID,
      role: "assessor",
      nome: "Maria",
      email: "m@x.com",
      ativo: true,
    });
    const r = await createClientPortalAccessAction(makeFormData());
    expect(r).toEqual({ error: expect.stringContaining("Apenas ADM/Sócio") });
  });
});
