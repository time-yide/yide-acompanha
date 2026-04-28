import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());
const requireAuthMock = vi.hoisted(() => vi.fn());
const dispatchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromMock }),
}));

vi.mock("@/lib/auth/session", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/lib/notificacoes/dispatch", () => ({
  dispatchNotification: dispatchMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { markStepProntoAction, updateChecklistFieldAction } from "@/lib/painel/actions";

beforeEach(() => {
  fromMock.mockReset();
  requireAuthMock.mockReset();
  dispatchMock.mockReset();
  requireAuthMock.mockResolvedValue({ id: "u1", role: "assessor", nome: "Maria", organization_id: "org1" });
});

describe("markStepProntoAction", () => {
  it("rejeita stepId inválido", async () => {
    const fd = new FormData();
    fd.set("step_id", "not-a-uuid");
    const r = await markStepProntoAction(fd);
    expect(r).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it("marca etapa cronograma como pronto e cria/atualiza próxima (design) com responsavel = designer_id", async () => {
    const updateStepMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    const upsertNextStepMock = vi.fn().mockResolvedValue({ error: null });

    fromMock.mockImplementation((table) => {
      if (table === "checklist_step") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "step-cronograma",
                  checklist_id: "cl1",
                  step_key: "cronograma",
                  status: "em_andamento",
                  responsavel_id: "u1",
                  client_monthly_checklist: {
                    id: "cl1",
                    client_id: "c1",
                    cliente: {
                      id: "c1",
                      assessor_id: "u-assessor",
                      coordenador_id: "u-coord",
                      designer_id: "u-designer",
                      videomaker_id: "u-vm",
                      editor_id: "u-ed",
                    },
                  },
                },
              }),
            }),
          }),
          update: updateStepMock,
          upsert: upsertNextStepMock,
        };
      }
      return {};
    });

    const fd = new FormData();
    fd.set("step_id", "00000000-0000-0000-0000-000000000001");
    const r = await markStepProntoAction(fd);
    expect(r).toEqual(expect.objectContaining({ success: true }));
    expect(updateStepMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pronto", completed_by: "u1" }),
    );
    expect(upsertNextStepMock).toHaveBeenCalledWith(
      expect.objectContaining({
        step_key: "design",
        responsavel_id: "u-designer",
        status: "em_andamento",
      }),
      expect.any(Object),
    );
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ evento_tipo: "checklist_step_delegada" }),
    );
  });

  it("marca paralela (tpg) como pronto e dispara notificação 'checklist_step_concluida' (não cria próxima)", async () => {
    const updateStepMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    fromMock.mockImplementation((table) => {
      if (table === "checklist_step") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "step-tpg",
                  checklist_id: "cl1",
                  step_key: "tpg",
                  status: "em_andamento",
                  responsavel_id: "u1",
                  client_monthly_checklist: {
                    id: "cl1",
                    client_id: "c1",
                    cliente: {
                      id: "c1",
                      assessor_id: "u-assessor",
                      coordenador_id: "u-coord",
                      designer_id: "u-designer",
                      videomaker_id: "u-vm",
                      editor_id: "u-ed",
                    },
                  },
                },
              }),
            }),
          }),
          update: updateStepMock,
        };
      }
      return {};
    });

    const fd = new FormData();
    fd.set("step_id", "00000000-0000-0000-0000-000000000002");
    const r = await markStepProntoAction(fd);
    expect(r).toEqual(expect.objectContaining({ success: true }));
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ evento_tipo: "checklist_step_concluida" }),
    );
  });

  it("camera quando mobile já pronto → desbloqueia edição com editor_id", async () => {
    const updateStepMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    const upsertNextStepMock = vi.fn().mockResolvedValue({ error: null });

    fromMock.mockImplementation((table) => {
      if (table === "checklist_step") {
        return {
          select: (cols: string) => {
            if (cols.includes("client_monthly_checklist")) {
              return {
                eq: () => ({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: "step-camera",
                      checklist_id: "cl1",
                      step_key: "camera",
                      status: "em_andamento",
                      responsavel_id: "u1",
                      client_monthly_checklist: {
                        id: "cl1",
                        client_id: "c1",
                        cliente: {
                          id: "c1",
                          assessor_id: "u-assessor",
                          coordenador_id: "u-coord",
                          designer_id: "u-designer",
                          videomaker_id: "u-vm",
                          editor_id: "u-editor",
                        },
                      },
                    },
                  }),
                }),
              };
            }
            // 2nd select call for mobile status check
            return {
              eq: () => ({
                eq: vi.fn().mockResolvedValue({
                  data: [{ status: "pronto" }],
                }),
              }),
            };
          },
          update: updateStepMock,
          upsert: upsertNextStepMock,
        };
      }
      return {};
    });

    const fd = new FormData();
    fd.set("step_id", "00000000-0000-0000-0000-000000000003");
    const r = await markStepProntoAction(fd);
    expect(r).toEqual(expect.objectContaining({ success: true }));
    expect(upsertNextStepMock).toHaveBeenCalledWith(
      expect.objectContaining({ step_key: "edicao", responsavel_id: "u-editor" }),
      expect.any(Object),
    );
  });
});

describe("updateChecklistFieldAction", () => {
  it("atualiza valor_trafego_mes", async () => {
    const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    fromMock.mockImplementation((table) => {
      if (table === "client_monthly_checklist") {
        return { update: updateMock };
      }
      return {};
    });

    const fd = new FormData();
    fd.set("checklist_id", "00000000-0000-0000-0000-000000000010");
    fd.set("field", "valor_trafego_mes");
    fd.set("value", "2500");
    const r = await updateChecklistFieldAction(fd);
    expect(r).toEqual(expect.objectContaining({ success: true }));
    expect(updateMock).toHaveBeenCalledWith({ valor_trafego_mes: 2500 });
  });

  it("rejeita campo não permitido", async () => {
    const fd = new FormData();
    fd.set("checklist_id", "00000000-0000-0000-0000-000000000010");
    fd.set("field", "client_id");
    fd.set("value", "anything");
    const r = await updateChecklistFieldAction(fd);
    expect(r).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });
});
