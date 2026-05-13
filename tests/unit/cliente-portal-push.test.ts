import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());
const sendWebPushToUserMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

vi.mock("@/lib/push/server", () => ({
  sendWebPushToUser: sendWebPushToUserMock,
}));

import { sendPushToClient } from "@/lib/cliente-portal/push";

const CLIENT_ID = "22222222-2222-2222-2222-222222222222";
const PAYLOAD = { title: "T", body: "B", url: "/cliente" };

function setupPortalUsers(rows: Array<{ user_id: string; ativo: boolean }>) {
  fromMock.mockImplementation((table: string) => {
    if (table !== "client_portal_users") throw new Error(`unexpected ${table}`);
    return {
      select: () => ({
        eq: (col1: string, val1: unknown) => ({
          eq: (col2: string, val2: unknown) => {
            const filtered = rows.filter(
              (r) =>
                (col1 === "client_id" ? CLIENT_ID === val1 : true) &&
                (col2 === "ativo" ? r.ativo === val2 : true),
            );
            return Promise.resolve({ data: filtered, error: null });
          },
        }),
      }),
    };
  });
}

beforeEach(() => {
  fromMock.mockReset();
  sendWebPushToUserMock.mockReset();
  sendWebPushToUserMock.mockResolvedValue(undefined);
});

describe("sendPushToClient", () => {
  it("envia push pra todos os portal users ATIVOS do cliente", async () => {
    setupPortalUsers([
      { user_id: "u1", ativo: true },
      { user_id: "u2", ativo: true },
      { user_id: "u3", ativo: false },
    ]);
    await sendPushToClient(CLIENT_ID, PAYLOAD);
    expect(sendWebPushToUserMock).toHaveBeenCalledTimes(2);
    expect(sendWebPushToUserMock).toHaveBeenCalledWith("u1", PAYLOAD);
    expect(sendWebPushToUserMock).toHaveBeenCalledWith("u2", PAYLOAD);
    expect(sendWebPushToUserMock).not.toHaveBeenCalledWith("u3", PAYLOAD);
  });

  it("não chama push quando cliente não tem portal user ativo", async () => {
    setupPortalUsers([{ user_id: "u1", ativo: false }]);
    await sendPushToClient(CLIENT_ID, PAYLOAD);
    expect(sendWebPushToUserMock).not.toHaveBeenCalled();
  });

  it("falha de um device não impede os outros", async () => {
    setupPortalUsers([
      { user_id: "u1", ativo: true },
      { user_id: "u2", ativo: true },
    ]);
    sendWebPushToUserMock.mockImplementationOnce(() =>
      Promise.reject(new Error("device offline")),
    );
    sendWebPushToUserMock.mockImplementationOnce(() => Promise.resolve());
    await expect(sendPushToClient(CLIENT_ID, PAYLOAD)).resolves.toBeUndefined();
    expect(sendWebPushToUserMock).toHaveBeenCalledTimes(2);
  });
});
