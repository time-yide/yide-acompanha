import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAuthMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());
const logAuditMock = vi.hoisted(() => vi.fn());

// PDF generator imports server-only Chromium/Puppeteer at module load; mock the
// whole module so the actions.ts import graph resolves in jsdom.
vi.mock("@/lib/apresenta-yide/pdf-generator", () => ({
  generatePdfFromUrl: vi.fn(),
}));

// env.ts validates env vars at module load; stub so import doesn't throw.
vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({ APRESENTACAO_PDF_SECRET: "test-secret" }),
  env: { NEXT_PUBLIC_APP_URL: "http://localhost:3000" },
}));

vi.mock("@/lib/auth/session", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

vi.mock("@/lib/audit/log", () => ({
  logAudit: logAuditMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { atualizarSlideAction, excluirSlideAction } from "@/lib/apresenta-yide/actions";

// Use valid v4 UUIDs (Zod 4 enforces version + variant nibbles).
const APRES_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_ID = "22222222-2222-4222-8222-222222222222";

const SLIDE_CAPA = {
  template: "capa" as const,
  content: { template: "capa" as const, titulo: "Yide" },
};
const SLIDE_CONTEUDO = {
  template: "conteudo" as const,
  content: { template: "conteudo" as const, titulo: "Sobre", texto: "txt" },
};

function setupApresentacaoMock(opts: {
  ownerId?: string;
  slides?: unknown[];
  notFound?: boolean;
}) {
  const updateEqMock = vi.fn().mockResolvedValue({ error: null });
  const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });

  fromMock.mockImplementation((table: string) => {
    if (table !== "apresentacoes_yide") throw new Error(`unexpected ${table}`);
    return {
      select: () => ({
        eq: () => ({
          single: vi.fn().mockResolvedValue({
            data: opts.notFound
              ? null
              : {
                  id: APRES_ID,
                  criado_por: opts.ownerId ?? ACTOR_ID,
                  slides: opts.slides ?? [SLIDE_CAPA, SLIDE_CONTEUDO],
                },
          }),
        }),
      }),
      update: updateMock,
    };
  });

  return { updateMock };
}

beforeEach(() => {
  requireAuthMock.mockReset();
  fromMock.mockReset();
  logAuditMock.mockReset();
  requireAuthMock.mockResolvedValue({
    id: ACTOR_ID,
    role: "comercial",
    nome: "Yasmin",
    email: "y@yide.com",
    ativo: true,
  });
  logAuditMock.mockResolvedValue(undefined);
});

function makeFormData(input: Record<string, unknown>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(input)) {
    fd.set(k, typeof v === "string" ? v : JSON.stringify(v));
  }
  return fd;
}

describe("atualizarSlideAction", () => {
  it("atualiza slide e persiste no DB", async () => {
    const { updateMock } = setupApresentacaoMock({});
    const novoContent = { template: "capa", titulo: "Novo título" };
    const r = await atualizarSlideAction(makeFormData({
      apresentacao_id: APRES_ID,
      slide_index: "0",
      content: novoContent,
    }));
    expect(r).toEqual({ success: true });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        slides: [
          { template: "capa", content: { template: "capa", titulo: "Novo título" } },
          SLIDE_CONTEUDO,
        ],
      }),
    );
  });

  it("rejeita slide_index fora do range", async () => {
    setupApresentacaoMock({});
    const r = await atualizarSlideAction(makeFormData({
      apresentacao_id: APRES_ID,
      slide_index: "5",
      content: { template: "capa", titulo: "x" },
    }));
    expect(r).toMatchObject({ error: expect.stringContaining("range") });
  });

  it("rejeita content com shape inválido", async () => {
    setupApresentacaoMock({});
    const r = await atualizarSlideAction(makeFormData({
      apresentacao_id: APRES_ID,
      slide_index: "0",
      content: { template: "capa" }, // sem titulo
    }));
    expect(r).toMatchObject({ error: expect.any(String) });
  });

  it("rejeita user que não é criador nem adm/sócio", async () => {
    setupApresentacaoMock({ ownerId: "outro-user-id" });
    const r = await atualizarSlideAction(makeFormData({
      apresentacao_id: APRES_ID,
      slide_index: "0",
      content: { template: "capa", titulo: "x" },
    }));
    expect(r).toMatchObject({ error: expect.stringContaining("permiss") });
  });

  it("permite adm editar slide de outro user", async () => {
    requireAuthMock.mockResolvedValueOnce({
      id: "adm-id",
      role: "adm",
      nome: "Admin",
      email: "a@yide.com",
      ativo: true,
    });
    setupApresentacaoMock({ ownerId: "outro-user-id" });
    const r = await atualizarSlideAction(makeFormData({
      apresentacao_id: APRES_ID,
      slide_index: "0",
      content: { template: "capa", titulo: "x" },
    }));
    expect(r).toEqual({ success: true });
  });
});

describe("excluirSlideAction", () => {
  it("remove slide do array", async () => {
    const { updateMock } = setupApresentacaoMock({});
    const r = await excluirSlideAction(makeFormData({
      apresentacao_id: APRES_ID,
      slide_index: "0",
    }));
    expect(r).toEqual({ success: true });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        slides: [SLIDE_CONTEUDO],
      }),
    );
  });

  it("rejeita index fora do range", async () => {
    setupApresentacaoMock({});
    const r = await excluirSlideAction(makeFormData({
      apresentacao_id: APRES_ID,
      slide_index: "99",
    }));
    expect(r).toMatchObject({ error: expect.stringContaining("range") });
  });

  it("rejeita sem permissão", async () => {
    setupApresentacaoMock({ ownerId: "outro-user-id" });
    const r = await excluirSlideAction(makeFormData({
      apresentacao_id: APRES_ID,
      slide_index: "0",
    }));
    expect(r).toMatchObject({ error: expect.stringContaining("permiss") });
  });
});
