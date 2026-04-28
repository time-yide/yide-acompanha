import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());
const requireAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromMock }),
}));

vi.mock("@/lib/auth/session", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { agendarReuniaoAction, marcarPerdidoAction, addLeadAttemptAction } from "@/lib/prospeccao/actions";

beforeEach(() => {
  fromMock.mockReset();
  requireAuthMock.mockReset();
  requireAuthMock.mockResolvedValue({ id: "u1", role: "comercial", nome: "Carla", organization_id: "org1" });
});

describe("agendarReuniaoAction", () => {
  it("rejeita tipo inválido", async () => {
    const fd = new FormData();
    fd.set("lead_id", "00000000-0000-0000-0000-000000000000");
    fd.set("tipo", "inválido");
    fd.set("data_hora", "2026-05-01T10:00:00Z");
    const r = await agendarReuniaoAction(fd);
    expect(r).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it("cria evento e atualiza lead.data_prospeccao_agendada quando tipo=prospeccao_agendada", async () => {
    const insertEventoMock = vi.fn().mockResolvedValue({ data: [{ id: "ev1" }], error: null });
    const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    fromMock.mockImplementation((table) => {
      if (table === "calendar_events") return { insert: insertEventoMock };
      if (table === "leads") {
        return {
          update: updateMock,
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { id: "l1", nome_prospect: "Empresa A", organization_id: "org1" },
              }),
            }),
          }),
        };
      }
      if (table === "audit_log") return { insert: vi.fn().mockResolvedValue({ error: null }) };
      return {};
    });

    const fd = new FormData();
    fd.set("lead_id", "00000000-0000-0000-0000-000000000000");
    fd.set("tipo", "prospeccao_agendada");
    fd.set("data_hora", "2026-05-01T10:00:00Z");
    fd.set("descricao", "Apresentação inicial");

    const r = await agendarReuniaoAction(fd);
    expect(r).toEqual(expect.objectContaining({ success: true }));
    expect(insertEventoMock).toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data_prospeccao_agendada: "2026-05-01T10:00:00Z" }),
    );
  });

  it("cria evento e atualiza lead.data_reuniao_marco_zero quando tipo=marco_zero", async () => {
    const insertEventoMock = vi.fn().mockResolvedValue({ data: [{ id: "ev1" }], error: null });
    const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    fromMock.mockImplementation((table) => {
      if (table === "calendar_events") return { insert: insertEventoMock };
      if (table === "leads") {
        return {
          update: updateMock,
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { id: "l1", nome_prospect: "Empresa A", organization_id: "org1" },
              }),
            }),
          }),
        };
      }
      if (table === "audit_log") return { insert: vi.fn().mockResolvedValue({ error: null }) };
      return {};
    });

    const fd = new FormData();
    fd.set("lead_id", "00000000-0000-0000-0000-000000000000");
    fd.set("tipo", "marco_zero");
    fd.set("data_hora", "2026-05-15T14:00:00Z");

    const r = await agendarReuniaoAction(fd);
    expect(r).toEqual(expect.objectContaining({ success: true }));
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data_reuniao_marco_zero: "2026-05-15T14:00:00Z" }),
    );
  });
});

describe("marcarPerdidoAction", () => {
  it("rejeita motivo muito curto", async () => {
    const fd = new FormData();
    fd.set("lead_id", "00000000-0000-0000-0000-000000000000");
    fd.set("motivo", "ab");
    const r = await marcarPerdidoAction(fd);
    expect(r).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it("atualiza motivo_perdido no lead", async () => {
    const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    fromMock.mockImplementation((table) => {
      if (table === "leads") return { update: updateMock };
      if (table === "audit_log") return { insert: vi.fn().mockResolvedValue({ error: null }) };
      return {};
    });

    const fd = new FormData();
    fd.set("lead_id", "00000000-0000-0000-0000-000000000000");
    fd.set("motivo", "Cliente escolheu concorrente");

    const r = await marcarPerdidoAction(fd);
    expect(r).toEqual(expect.objectContaining({ success: true }));
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ motivo_perdido: "Cliente escolheu concorrente" }),
    );
  });
});

describe("addLeadAttemptAction", () => {
  it("insere em lead_attempts com autor_id do user logado", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });

    fromMock.mockImplementation((table) => {
      if (table === "lead_attempts") return { insert: insertMock };
      return {};
    });

    const fd = new FormData();
    fd.set("lead_id", "00000000-0000-0000-0000-000000000000");
    fd.set("canal", "whatsapp");
    fd.set("resultado", "sem_resposta");
    fd.set("observacao", "Sem resposta após 3 tentativas");

    const r = await addLeadAttemptAction(fd);
    expect(r).toEqual(expect.objectContaining({ success: true }));
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        lead_id: "00000000-0000-0000-0000-000000000000",
        canal: "whatsapp",
        resultado: "sem_resposta",
        autor_id: "u1",
      }),
    );
  });
});
