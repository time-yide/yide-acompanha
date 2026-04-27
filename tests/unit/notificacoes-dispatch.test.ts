import { describe, it, expect, vi, beforeEach } from "vitest";

const { insertMock, selectMock, profileSelectMock, sendEmailMock } = vi.hoisted(() => ({
  insertMock: vi.fn(),
  selectMock: vi.fn(),
  profileSelectMock: vi.fn(),
  sendEmailMock: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => {
      if (table === "notification_rules") {
        return { select: () => ({ eq: () => ({ single: selectMock }) }) };
      }
      if (table === "notifications") {
        return { insert: insertMock };
      }
      if (table === "notification_preferences") {
        return {
          select: () => ({
            in: () => ({ eq: () => ({ data: [] }) }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            in: () => ({ eq: () => ({ data: [] }) }),
            eq: () => ({ single: profileSelectMock }),
          }),
        };
      }
      return {};
    },
  }),
}));

vi.mock("@/lib/email/client", () => ({ sendEmail: sendEmailMock }));

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({ NEXT_PUBLIC_APP_URL: "https://test.local" }),
}));

import { dispatchNotification } from "@/lib/notificacoes/dispatch";

beforeEach(() => {
  insertMock.mockReset();
  insertMock.mockResolvedValue({ error: null });
  selectMock.mockReset();
  profileSelectMock.mockReset();
  sendEmailMock.mockReset();
});

describe("dispatchNotification", () => {
  it("não dispatch quando regra está ativa=false", async () => {
    selectMock.mockResolvedValue({
      data: { evento_tipo: "task_assigned", ativo: false, mandatory: false, email_default: false, permite_destinatarios_extras: true, default_roles: [], default_user_ids: [] },
    });
    await dispatchNotification({
      evento_tipo: "task_assigned",
      titulo: "X",
      mensagem: "Y",
      user_ids_extras: ["user-1"],
    });
    expect(insertMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("não dispatch quando regra não existe", async () => {
    selectMock.mockResolvedValue({ data: null });
    await dispatchNotification({
      evento_tipo: "task_assigned",
      titulo: "X",
      mensagem: "Y",
    });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("excluí source_user_id da lista de destinatários", async () => {
    selectMock.mockResolvedValue({
      data: { evento_tipo: "task_assigned", ativo: true, mandatory: false, email_default: false, permite_destinatarios_extras: true, default_roles: [], default_user_ids: [] },
    });
    await dispatchNotification({
      evento_tipo: "task_assigned",
      titulo: "X",
      mensagem: "Y",
      user_ids_extras: ["user-1", "user-2"],
      source_user_id: "user-1",
    });
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ user_id: "user-2" }));
  });

  it("ignora user_ids_extras quando permite_destinatarios_extras=false", async () => {
    selectMock.mockResolvedValue({
      data: { evento_tipo: "deal_fechado", ativo: true, mandatory: false, email_default: false, permite_destinatarios_extras: false, default_roles: [], default_user_ids: [] },
    });
    await dispatchNotification({
      evento_tipo: "deal_fechado",
      titulo: "X",
      mensagem: "Y",
      user_ids_extras: ["user-1"],
    });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("retorna early se não há destinatários", async () => {
    selectMock.mockResolvedValue({
      data: { evento_tipo: "task_assigned", ativo: true, mandatory: false, email_default: false, permite_destinatarios_extras: true, default_roles: [], default_user_ids: [] },
    });
    await dispatchNotification({
      evento_tipo: "task_assigned",
      titulo: "X",
      mensagem: "Y",
    });
    expect(insertMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
