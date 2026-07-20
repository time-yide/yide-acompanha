import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());
const requireAuthMock = vi.hoisted(() => vi.fn());
const removeMock = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));
const uploadMock = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));
const createSignedUrlMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.example/pdf" } }),
);

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({
    from: fromMock,
    storage: {
      from: () => ({
        remove: removeMock,
        upload: uploadMock,
        createSignedUrl: createSignedUrlMock,
      }),
    },
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromMock }),
}));
vi.mock("@/lib/auth/session", () => ({ requireAuth: requireAuthMock }));
vi.mock("@/lib/trafego/relatorios/meta-fetch", () => ({
  fetchDadosMeta: vi.fn().mockResolvedValue({ ok: true, dados: { spend: 1000 } }),
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn() }));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: () => unknown) => fn,
}));
vi.mock("@/lib/units/session", () => ({
  getEffectiveUnitId: vi.fn().mockResolvedValue("unit-1"),
}));

import {
  criarRelatorioAction,
  excluirRelatorioAction,
  publicarRelatorioAction,
} from "@/lib/trafego/relatorios/actions";

beforeEach(() => {
  fromMock.mockReset();
  requireAuthMock.mockReset();
  removeMock.mockClear();
  uploadMock.mockClear();
  createSignedUrlMock.mockClear();
});

describe("trafego_relatorios fluxo", () => {
  it("criarRelatorioAction: fonte_dados='meta_api' quando Meta ok e sem manuais", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "socio" });
    const insertMock = vi.fn().mockReturnValue({
      select: () => ({
        single: vi.fn().mockResolvedValue({ data: { id: "rel-1" }, error: null }),
      }),
    });
    fromMock.mockImplementation((t: string) => {
      if (t === "clients") return {
        select: () => ({
          eq: () => ({
            single: vi.fn().mockResolvedValue({
              data: { organization_id: "org-1", unit_id: "unit-1", nome: "Acme" },
            }),
          }),
        }),
      };
      if (t === "trafego_relatorios") return { insert: insertMock };
      return {};
    });

    const fd = new FormData();
    fd.set("cliente_id", "00000000-0000-0000-0000-000000000001");
    fd.set("periodo_inicio", "2026-04-01");
    fd.set("periodo_fim", "2026-04-30");

    const r = await criarRelatorioAction(fd);
    expect("redirect" in r ? r.redirect : null).toBe("/trafego/relatorios/rel-1");
    const insertArg = insertMock.mock.calls[0][0];
    expect(insertArg.fonte_dados).toBe("meta_api");
    // Relatório estilo Reportei nasce "pronta" (sem etapa de slides de IA).
    expect(insertArg.status).toBe("pronta");
  });

  it("publicarRelatorioAction: bloqueia se status != pronta", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "socio" });
    fromMock.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          single: vi.fn().mockResolvedValue({
            data: { cliente_id: "c1", status: "rascunho", pdf_storage_path: null },
          }),
        }),
      }),
    }));
    const fd = new FormData();
    fd.set("id", "00000000-0000-0000-0000-00000000abcd");
    const r = await publicarRelatorioAction(fd);
    expect("error" in r ? r.error : null).toMatch(/slides antes/);
  });

  it("publicarRelatorioAction: bloqueia se PDF não foi gerado", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "socio" });
    fromMock.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          single: vi.fn().mockResolvedValue({
            data: { cliente_id: "c1", status: "pronta", pdf_storage_path: null },
          }),
        }),
      }),
    }));
    const fd = new FormData();
    fd.set("id", "00000000-0000-0000-0000-00000000abcd");
    const r = await publicarRelatorioAction(fd);
    expect("error" in r ? r.error : null).toMatch(/PDF antes/);
  });

  it("excluirRelatorioAction: deleta e remove PDF do storage", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "socio" });
    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          single: vi.fn().mockResolvedValue({
            data: { cliente_id: "c1", pdf_storage_path: "org/abc.pdf" },
          }),
        }),
      }),
      delete: () => ({ eq: deleteEq }),
    }));

    const fd = new FormData();
    fd.set("id", "00000000-0000-0000-0000-00000000abcd");
    const r = await excluirRelatorioAction(fd);
    expect("success" in r ? r.success : null).toBe(true);
    expect(deleteEq).toHaveBeenCalled();
    expect(removeMock).toHaveBeenCalledWith(["org/abc.pdf"]);
  });

  it("criarRelatorioAction: rejeita sem permissão", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "videomaker" });
    const fd = new FormData();
    fd.set("cliente_id", "00000000-0000-0000-0000-000000000001");
    fd.set("periodo_inicio", "2026-04-01");
    fd.set("periodo_fim", "2026-04-30");
    const r = await criarRelatorioAction(fd);
    expect("error" in r ? r.error : null).toMatch(/permissão/i);
  });
});
