import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAuthMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());
const dispatchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  requireAuth: requireAuthMock,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromMock }),
}));
vi.mock("@/lib/notificacoes/dispatch", () => ({
  dispatchNotification: dispatchMock,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  setGmnDataAction,
  setTpgTpmAction,
  setMonthlyPostsAction,
} from "@/lib/painel/actions";

const ACTOR = {
  id: "11111111-1111-1111-1111-111111111111",
  role: "assessor" as const,
  nome: "x",
  email: "a@x.com",
  ativo: true,
  avatarUrl: null,
};
const CHECKLIST_ID = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  requireAuthMock.mockResolvedValue(ACTOR);
});

describe("setGmnDataAction", () => {
  it("rejeita nota fora de 0..5", async () => {
    const fd = new FormData();
    fd.set("checklist_id", CHECKLIST_ID);
    fd.set("gmn_comentarios", "10");
    fd.set("gmn_avaliacoes", "5");
    fd.set("gmn_nota_media", "7");
    const result = await setGmnDataAction(fd);
    expect(result).toHaveProperty("error");
  });

  it("salva quando válido", async () => {
    fromMock.mockReturnValue({
      update: () => ({ eq: async () => ({ error: null }) }),
    });
    const fd = new FormData();
    fd.set("checklist_id", CHECKLIST_ID);
    fd.set("gmn_comentarios", "10");
    fd.set("gmn_avaliacoes", "5");
    fd.set("gmn_nota_media", "4.7");
    fd.set("gmn_observacoes", "Subiu 3 posições");
    const result = await setGmnDataAction(fd);
    expect(result).toEqual({ success: true });
  });
});

describe("setTpgTpmAction", () => {
  it("rejeita field inválido", async () => {
    const fd = new FormData();
    fd.set("checklist_id", CHECKLIST_ID);
    fd.set("field", "valor_trafego_mes");
    fd.set("ativo", "true");
    const result = await setTpgTpmAction(fd);
    expect(result).toHaveProperty("error");
  });

  it("aceita field tpg_ativo válido", async () => {
    fromMock.mockReturnValue({
      update: () => ({ eq: async () => ({ error: null }) }),
    });
    const fd = new FormData();
    fd.set("checklist_id", CHECKLIST_ID);
    fd.set("field", "tpg_ativo");
    fd.set("ativo", "true");
    const result = await setTpgTpmAction(fd);
    expect(result).toEqual({ success: true });
  });

  it("aceita field tpm_ativo com inativo", async () => {
    fromMock.mockReturnValue({
      update: () => ({ eq: async () => ({ error: null }) }),
    });
    const fd = new FormData();
    fd.set("checklist_id", CHECKLIST_ID);
    fd.set("field", "tpm_ativo");
    fd.set("ativo", "false");
    const result = await setTpgTpmAction(fd);
    expect(result).toEqual({ success: true });
  });
});

describe("setMonthlyPostsAction", () => {
  it("aceita postagens 5/8", async () => {
    fromMock.mockReturnValue({
      update: () => ({ eq: async () => ({ error: null }) }),
    });
    const fd = new FormData();
    fd.set("checklist_id", CHECKLIST_ID);
    fd.set("pacote_post", "8");
    fd.set("quantidade_postada", "5");
    const result = await setMonthlyPostsAction(fd);
    expect(result).toEqual({ success: true });
  });

  it("rejeita números negativos", async () => {
    const fd = new FormData();
    fd.set("checklist_id", CHECKLIST_ID);
    fd.set("pacote_post", "-1");
    fd.set("quantidade_postada", "0");
    const result = await setMonthlyPostsAction(fd);
    expect(result).toHaveProperty("error");
  });
});
