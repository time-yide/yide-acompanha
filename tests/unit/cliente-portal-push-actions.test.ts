import { describe, it, expect, vi, beforeEach } from "vitest";

const requireClientPortalAuthMock = vi.hoisted(() => vi.fn());
const upsertMock = vi.hoisted(() => vi.fn());
const deleteEqEndpointMock = vi.hoisted(() => vi.fn());
const countSelectMock = vi.hoisted(() => vi.fn());
const sendWebPushToUserMock = vi.hoisted(() => vi.fn());
const getServerEnvMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/client-portal-session", () => ({
  requireClientPortalAuth: requireClientPortalAuthMock,
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => {
      if (table !== "push_subscriptions") throw new Error(`unexpected table ${table}`);
      return {
        upsert: upsertMock,
        delete: () => ({
          eq: (_col1: string, _val1: string) => ({
            eq: (_col2: string, _val2: string) =>
              deleteEqEndpointMock(_col1, _val1, _col2, _val2),
          }),
        }),
        select: () => ({
          eq: (col: string, val: string) => countSelectMock(col, val),
        }),
      };
    },
  }),
}));

vi.mock("@/lib/push/server", () => ({
  sendWebPushToUser: sendWebPushToUserMock,
}));

vi.mock("@/lib/env", () => ({
  getServerEnv: getServerEnvMock,
}));

import {
  subscribeClientPortalPushAction,
  unsubscribeClientPortalPushAction,
  sendTestClientPortalPushAction,
} from "@/lib/cliente-portal/push-actions";

const PORTAL_USER_ID = "11111111-1111-1111-1111-111111111111";
const CLIENT_ID = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
  requireClientPortalAuthMock.mockReset();
  upsertMock.mockReset();
  deleteEqEndpointMock.mockReset();
  countSelectMock.mockReset();
  sendWebPushToUserMock.mockReset();
  getServerEnvMock.mockReset();
  requireClientPortalAuthMock.mockResolvedValue({
    userId: PORTAL_USER_ID,
    clientId: CLIENT_ID,
    nomeContato: "Sócio Teste",
  });
  getServerEnvMock.mockReturnValue({
    VAPID_PUBLIC_KEY: "pubk",
    VAPID_PRIVATE_KEY: "privk",
    VAPID_SUBJECT: "mailto:ops@yide.com",
  });
});

function makeSubscribeFormData() {
  const fd = new FormData();
  fd.set("endpoint", "https://fcm.googleapis.com/fcm/send/abc123");
  fd.set("p256dh", "p256dh-key-base64");
  fd.set("auth", "auth-key-base64");
  fd.set("user_agent", "Mozilla/5.0 (iPhone)");
  return fd;
}

describe("subscribeClientPortalPushAction", () => {
  it("salva subscription pro portal user logado", async () => {
    upsertMock.mockResolvedValue({ error: null });
    const r = await subscribeClientPortalPushAction(makeSubscribeFormData());
    expect(r).toEqual({ success: true });
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: PORTAL_USER_ID,
        endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
        p256dh: "p256dh-key-base64",
        auth: "auth-key-base64",
        user_agent: "Mozilla/5.0 (iPhone)",
      }),
      { onConflict: "user_id,endpoint" },
    );
  });

  it("retorna erro de validação se endpoint não for URL", async () => {
    const fd = new FormData();
    fd.set("endpoint", "not-a-url");
    fd.set("p256dh", "p256dh");
    fd.set("auth", "auth");
    const r = await subscribeClientPortalPushAction(fd);
    expect(r).toMatchObject({ error: expect.any(String) });
    expect(upsertMock).not.toHaveBeenCalled();
  });
});

describe("unsubscribeClientPortalPushAction", () => {
  it("apaga subscription pelo endpoint do user logado", async () => {
    deleteEqEndpointMock.mockResolvedValue({ error: null });
    const fd = new FormData();
    fd.set("endpoint", "https://fcm.googleapis.com/fcm/send/abc123");
    const r = await unsubscribeClientPortalPushAction(fd);
    expect(r).toEqual({ success: true });
    expect(deleteEqEndpointMock).toHaveBeenCalledWith(
      "user_id",
      PORTAL_USER_ID,
      "endpoint",
      "https://fcm.googleapis.com/fcm/send/abc123",
    );
  });
});

describe("sendTestClientPortalPushAction", () => {
  it("retorna erro se VAPID não configurado", async () => {
    getServerEnvMock.mockReturnValue({});
    const r = await sendTestClientPortalPushAction();
    expect(r).toMatchObject({ error: expect.stringContaining("VAPID") });
  });

  it("retorna erro se user ainda não tem subscription", async () => {
    countSelectMock.mockReturnValue({ count: 0 });
    const r = await sendTestClientPortalPushAction();
    expect(r).toMatchObject({ error: expect.stringContaining("Nenhum dispositivo") });
    expect(sendWebPushToUserMock).not.toHaveBeenCalled();
  });

  it("dispara push pro user quando tudo ok", async () => {
    countSelectMock.mockReturnValue({ count: 1 });
    sendWebPushToUserMock.mockResolvedValue(undefined);
    const r = await sendTestClientPortalPushAction();
    expect(r).toEqual({ success: true });
    expect(sendWebPushToUserMock).toHaveBeenCalledWith(
      PORTAL_USER_ID,
      expect.objectContaining({
        title: expect.stringContaining("Yide"),
        body: expect.stringContaining("Push"),
        url: "/cliente",
        tag: "test",
      }),
    );
  });
});
