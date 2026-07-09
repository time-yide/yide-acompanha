import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());
const requireAuthMock = vi.hoisted(() => vi.fn());
const dispatchMock = vi.hoisted(() => vi.fn());
const coordIdsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: fromMock }) }));
vi.mock("@/lib/auth/session", () => ({ requireAuth: requireAuthMock }));
vi.mock("@/lib/notificacoes/dispatch", () => ({ dispatchNotification: dispatchMock }));
vi.mock("@/lib/tarefas/client-team", () => ({ getCoordenadoresAudiovisualIds: coordIdsMock }));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import {
  solicitarBloqueioAction,
  aprovarBloqueioAction,
  rejeitarBloqueioAction,
} from "@/lib/audiovisual/bloqueios/actions";

beforeEach(() => {
  fromMock.mockReset();
  requireAuthMock.mockReset();
  dispatchMock.mockReset();
  coordIdsMock.mockReset().mockResolvedValue(["coord-1"]);
});

function fd(obj: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}

function mockInsert() {
  fromMock.mockImplementation((t: string) => {
    if (t === "agenda_bloqueios") {
      return {
        insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "b1" }, error: null }) }) }),
      };
    }
    if (t === "profiles") {
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { organization_id: "org-1" } }) }) }) };
    }
    return {};
  });
}

describe("solicitarBloqueioAction", () => {
  it("videomaker cria pendente e notifica coordenadores", async () => {
    requireAuthMock.mockResolvedValue({ id: "vm-1", role: "videomaker", nome: "Hanna" });
    mockInsert();
    const r = await solicitarBloqueioAction(
      fd({ data: "2026-07-10", hora_inicio: "14:00", hora_fim: "15:00", motivo: "Consulta médica" }),
    );
    expect(r?.error).toBeUndefined();
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ evento_tipo: "bloqueio_agenda_solicitado", user_ids_extras: ["coord-1"] }),
    );
  });

  it("rejeita horário inválido sem inserir", async () => {
    requireAuthMock.mockResolvedValue({ id: "vm-1", role: "videomaker", nome: "Hanna" });
    mockInsert();
    const r = await solicitarBloqueioAction(
      fd({ data: "2026-07-10", hora_inicio: "15:00", hora_fim: "14:00", motivo: "x" }),
    );
    expect(r?.error).toBeTruthy();
    expect(dispatchMock).not.toHaveBeenCalled();
  });
});

describe("aprovar/rejeitar", () => {
  function mockUpdateAndFetch(row: Record<string, unknown>) {
    const updateEq2 = vi.fn().mockResolvedValue({ error: null });
    const updateEq1 = vi.fn().mockReturnValue({ eq: updateEq2 });
    const update = vi.fn().mockReturnValue({ eq: updateEq1 });
    fromMock.mockImplementation((t: string) => {
      if (t === "agenda_bloqueios") {
        return {
          update,
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: row }) }) }),
        };
      }
      return {};
    });
    return { update };
  }

  it("audiovisual_chefe aprova e notifica o videomaker", async () => {
    requireAuthMock.mockResolvedValue({ id: "coord-1", role: "audiovisual_chefe", nome: "Coord" });
    mockUpdateAndFetch({ id: "b1", criado_por: "vm-1", status: "aprovada", data: "2026-07-10", hora_inicio: "14:00:00", hora_fim: "15:00:00" });
    const r = await aprovarBloqueioAction("b1");
    expect(r?.error).toBeUndefined();
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ evento_tipo: "bloqueio_agenda_respondido", user_ids_extras: ["vm-1"] }),
    );
  });

  it("videomaker NÃO pode aprovar", async () => {
    requireAuthMock.mockResolvedValue({ id: "vm-1", role: "videomaker", nome: "Hanna" });
    mockUpdateAndFetch({ id: "b1", criado_por: "vm-1", status: "pendente" });
    const r = await aprovarBloqueioAction("b1");
    expect(r?.error).toBeTruthy();
  });

  it("rejeitar sem motivo falha", async () => {
    requireAuthMock.mockResolvedValue({ id: "coord-1", role: "audiovisual_chefe", nome: "Coord" });
    mockUpdateAndFetch({ id: "b1", criado_por: "vm-1", status: "pendente" });
    const r = await rejeitarBloqueioAction(fd({ id: "11111111-1111-1111-1111-111111111111", motivo_recusa: "" }));
    expect(r?.error).toBeTruthy();
  });
});
