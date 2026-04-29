import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAuthMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());
const serviceFromMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromMock }),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: serviceFromMock }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));

import {
  updateClienteAssignmentAction,
  bulkAssignClientesAction,
} from "@/lib/clientes/actions";

const ACTOR = "11111111-1111-1111-1111-111111111111";
const CLIENT_A = "22222222-2222-2222-2222-222222222222";
const CLIENT_B = "33333333-3333-3333-3333-333333333333";
const ASSESSOR = "44444444-4444-4444-4444-444444444444";
const ASSESSOR_2 = "55555555-5555-5555-5555-555555555555";
const COORDENADOR = "66666666-6666-6666-6666-666666666666";

interface ProfileShape {
  role: "assessor" | "coordenador" | "adm" | "socio";
}

interface ClientShape {
  id: string;
  assessor_id: string | null;
  coordenador_id: string | null;
}

/**
 * Configura o mock de createClient().from() para o action.
 * - profilesById: lookup de role em profiles
 * - clientsById: lookup do "before" do cliente
 * Captura update payloads e .in()/.eq().
 */
function setupSupabase(opts: {
  profilesById?: Record<string, ProfileShape>;
  clientsById?: Record<string, ClientShape>;
  updateError?: { message: string } | null;
}) {
  const updateCalls: Array<{
    payload: Record<string, unknown>;
    eqArgs?: [string, unknown];
    inArgs?: [string, unknown[]];
  }> = [];

  fromMock.mockImplementation((table: string) => {
    if (table === "profiles") {
      return {
        select: () => ({
          eq: (_col: string, val: string) => ({
            single: vi.fn().mockResolvedValue({
              data: opts.profilesById?.[val] ?? null,
              error: opts.profilesById?.[val] ? null : { message: "not found" },
            }),
          }),
        }),
      };
    }
    if (table === "clients") {
      return {
        select: () => ({
          eq: (_col: string, val: string) => ({
            single: vi.fn().mockResolvedValue({
              data: opts.clientsById?.[val] ?? null,
              error: opts.clientsById?.[val] ? null : { message: "not found" },
            }),
          }),
        }),
        update: (payload: Record<string, unknown>) => ({
          eq: (col: string, val: unknown) => {
            updateCalls.push({ payload, eqArgs: [col, val] });
            return Promise.resolve({ error: opts.updateError ?? null });
          },
          in: (col: string, vals: unknown[]) => {
            updateCalls.push({ payload, inArgs: [col, vals] });
            return Promise.resolve({ error: opts.updateError ?? null });
          },
        }),
      };
    }
    return { insert: vi.fn().mockResolvedValue({ error: null }) };
  });

  const auditInsert = vi.fn().mockResolvedValue({ error: null });
  serviceFromMock.mockImplementation((table: string) => {
    if (table === "audit_log") return { insert: auditInsert };
    return { insert: vi.fn().mockResolvedValue({ error: null }) };
  });

  return { updateCalls, auditInsert };
}

beforeEach(() => {
  requireAuthMock.mockReset();
  fromMock.mockReset();
  serviceFromMock.mockReset();
  requireAuthMock.mockResolvedValue({
    id: ACTOR,
    role: "socio",
    nome: "Dono",
    email: "socio@x.com",
    ativo: true,
  });
});

describe("updateClienteAssignmentAction", () => {
  it("retorna erro de permissão se ator não é adm/socio", async () => {
    requireAuthMock.mockResolvedValueOnce({
      id: ACTOR,
      role: "assessor",
      nome: "M",
      email: "m@x.com",
      ativo: true,
    });
    const fd = new FormData();
    fd.set("cliente_id", CLIENT_A);
    fd.set("assessor_id", ASSESSOR);
    const r = await updateClienteAssignmentAction(fd);
    expect(r).toEqual({ error: "Sem permissão" });
  });

  it("retorna erro se cliente_id está ausente", async () => {
    const fd = new FormData();
    fd.set("assessor_id", ASSESSOR);
    const r = await updateClienteAssignmentAction(fd);
    expect(r).toEqual({ error: "ID do cliente inválido" });
  });

  it("retorna erro se cliente_id não é UUID", async () => {
    const fd = new FormData();
    fd.set("cliente_id", "not-a-uuid");
    fd.set("assessor_id", ASSESSOR);
    const r = await updateClienteAssignmentAction(fd);
    expect(r).toEqual({ error: "ID do cliente inválido" });
  });

  it("retorna erro se nem assessor_id nem coordenador_id estão no form", async () => {
    const fd = new FormData();
    fd.set("cliente_id", CLIENT_A);
    const r = await updateClienteAssignmentAction(fd);
    expect(r).toEqual({ error: "Nada para atualizar" });
  });

  it("idempotente: assessor_id no form mas igual ao before — sem update e sem audit", async () => {
    const { updateCalls, auditInsert } = setupSupabase({
      profilesById: { [ASSESSOR]: { role: "assessor" } },
      clientsById: {
        [CLIENT_A]: { id: CLIENT_A, assessor_id: ASSESSOR, coordenador_id: null },
      },
    });
    const fd = new FormData();
    fd.set("cliente_id", CLIENT_A);
    fd.set("assessor_id", ASSESSOR);
    const r = await updateClienteAssignmentAction(fd);
    expect(r).toEqual({ success: true });
    expect(updateCalls).toHaveLength(0);
    expect(auditInsert).not.toHaveBeenCalled();
  });

  it("atualiza apenas assessor (coord ausente do form): patch só com assessor_id", async () => {
    const { updateCalls, auditInsert } = setupSupabase({
      profilesById: { [ASSESSOR_2]: { role: "assessor" } },
      clientsById: {
        [CLIENT_A]: { id: CLIENT_A, assessor_id: ASSESSOR, coordenador_id: COORDENADOR },
      },
    });
    const fd = new FormData();
    fd.set("cliente_id", CLIENT_A);
    fd.set("assessor_id", ASSESSOR_2);
    const r = await updateClienteAssignmentAction(fd);
    expect(r).toEqual({ success: true });
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].payload).toEqual({ assessor_id: ASSESSOR_2 });
    expect(updateCalls[0].eqArgs).toEqual(["id", CLIENT_A]);

    expect(auditInsert).toHaveBeenCalledTimes(1);
    const payload = auditInsert.mock.calls[0][0];
    expect(payload).toEqual(
      expect.objectContaining({
        entidade: "clients",
        entidade_id: CLIENT_A,
        acao: "update",
        ator_id: ACTOR,
        justificativa: "Atribuição alterada via listagem",
        dados_antes: { assessor_id: ASSESSOR },
        dados_depois: { assessor_id: ASSESSOR_2 },
      }),
    );
  });

  it("assessor_id=\"\" significa unassign — patch envia null", async () => {
    const { updateCalls, auditInsert } = setupSupabase({
      clientsById: {
        [CLIENT_A]: { id: CLIENT_A, assessor_id: ASSESSOR, coordenador_id: null },
      },
    });
    const fd = new FormData();
    fd.set("cliente_id", CLIENT_A);
    fd.set("assessor_id", "");
    const r = await updateClienteAssignmentAction(fd);
    expect(r).toEqual({ success: true });
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].payload).toEqual({ assessor_id: null });

    expect(auditInsert).toHaveBeenCalledTimes(1);
    expect(auditInsert.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        dados_antes: { assessor_id: ASSESSOR },
        dados_depois: { assessor_id: null },
      }),
    );
  });

  it("retorna erro se assessor_id é de profile com role errado", async () => {
    const { updateCalls } = setupSupabase({
      profilesById: { [ASSESSOR]: { role: "coordenador" } },
      clientsById: {
        [CLIENT_A]: { id: CLIENT_A, assessor_id: null, coordenador_id: null },
      },
    });
    const fd = new FormData();
    fd.set("cliente_id", CLIENT_A);
    fd.set("assessor_id", ASSESSOR);
    const r = await updateClienteAssignmentAction(fd);
    expect(r).toEqual({ error: "Papel inválido para essa atribuição" });
    expect(updateCalls).toHaveLength(0);
  });
});

describe("bulkAssignClientesAction", () => {
  it("retorna erro de permissão se ator não é adm/socio", async () => {
    requireAuthMock.mockResolvedValueOnce({
      id: ACTOR,
      role: "assessor",
      nome: "M",
      email: "m@x.com",
      ativo: true,
    });
    const fd = new FormData();
    fd.set("cliente_ids", JSON.stringify([CLIENT_A]));
    fd.set("assessor_id", ASSESSOR);
    const r = await bulkAssignClientesAction(fd);
    expect(r).toEqual({ error: "Sem permissão" });
  });

  it("retorna erro se cliente_ids é JSON inválido", async () => {
    const fd = new FormData();
    fd.set("cliente_ids", "{not-json");
    fd.set("assessor_id", ASSESSOR);
    const r = await bulkAssignClientesAction(fd);
    expect(r).toEqual({ error: "Selecione ao menos um cliente" });
  });

  it("retorna erro se cliente_ids é array vazio", async () => {
    const fd = new FormData();
    fd.set("cliente_ids", JSON.stringify([]));
    fd.set("assessor_id", ASSESSOR);
    const r = await bulkAssignClientesAction(fd);
    expect(r).toEqual({ error: "Selecione ao menos um cliente" });
  });

  it("retorna erro de cap se cliente_ids > 500", async () => {
    const ids = Array.from(
      { length: 501 },
      (_, i) =>
        // Gera UUIDs sintéticos válidos pro regex do action.
        `${(i + 1).toString(16).padStart(8, "0")}-aaaa-aaaa-aaaa-aaaaaaaaaaaa`,
    );
    const fd = new FormData();
    fd.set("cliente_ids", JSON.stringify(ids));
    fd.set("assessor_id", ASSESSOR);
    const r = await bulkAssignClientesAction(fd);
    expect(r).toEqual({ error: "Limite de 500 clientes por operação" });
  });

  it("retorna erro se nem assessor nem coord são passados", async () => {
    const fd = new FormData();
    fd.set("cliente_ids", JSON.stringify([CLIENT_A, CLIENT_B]));
    const r = await bulkAssignClientesAction(fd);
    expect(r).toEqual({
      error: "Selecione assessor ou coordenador para atribuir",
    });
  });

  it("sucesso: chama update().in('id', ids), audit loga 1x por cliente, retorna {success, count}", async () => {
    const { updateCalls, auditInsert } = setupSupabase({
      profilesById: { [ASSESSOR]: { role: "assessor" } },
    });
    const fd = new FormData();
    fd.set("cliente_ids", JSON.stringify([CLIENT_A, CLIENT_B]));
    fd.set("assessor_id", ASSESSOR);
    const r = await bulkAssignClientesAction(fd);
    expect(r).toEqual({ success: true, count: 2 });

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].payload).toEqual({ assessor_id: ASSESSOR });
    expect(updateCalls[0].inArgs).toEqual(["id", [CLIENT_A, CLIENT_B]]);

    expect(auditInsert).toHaveBeenCalledTimes(2);
    const ids = auditInsert.mock.calls.map(
      (c: unknown[]) => (c[0] as { entidade_id: string }).entidade_id,
    );
    expect(ids.sort()).toEqual([CLIENT_A, CLIENT_B].sort());
    for (const call of auditInsert.mock.calls) {
      expect(call[0]).toEqual(
        expect.objectContaining({
          entidade: "clients",
          acao: "update",
          ator_id: ACTOR,
          justificativa: "Atribuição em massa via listagem",
          dados_depois: { assessor_id: ASSESSOR },
        }),
      );
    }
  });
});
