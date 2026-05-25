import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());
const fetchProfileSnapshotMock = vi.hoisted(() => vi.fn());
const listClientesParaCronMock = vi.hoisted(() => vi.fn());
const getSnapshotSeRecenteMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));
vi.mock("@/lib/instagram-snapshots/scraper", () => ({
  fetchProfileSnapshot: fetchProfileSnapshotMock,
}));
vi.mock("@/lib/instagram-snapshots/queries", () => ({
  listClientesParaCron: listClientesParaCronMock,
  getSnapshotSeRecente: getSnapshotSeRecenteMock,
}));

import { GET } from "@/app/api/cron/instagram-snapshots/route";

beforeEach(() => {
  fromMock.mockReset();
  fetchProfileSnapshotMock.mockReset();
  listClientesParaCronMock.mockReset();
  getSnapshotSeRecenteMock.mockReset();
});

function makeReq(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader) headers.set("authorization", authHeader);
  return new Request("https://test.local/api/cron/instagram-snapshots", { headers });
}

describe("cron /api/cron/instagram-snapshots", () => {
  it("retorna 401 se CRON_SECRET configurado e auth não bate", async () => {
    const original = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "secret-abc";
    const res = await GET(makeReq("Bearer wrong"));
    expect(res.status).toBe(401);
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  it("retorna ok:true sem clientes elegíveis", async () => {
    listClientesParaCronMock.mockResolvedValue([]);
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body).toEqual({ ok: true, total: 0, refreshed: 0, skipped: 0, errors: 0 });
  });

  it("skipa clientes com snapshot < 6h", async () => {
    listClientesParaCronMock.mockResolvedValue([
      { id: "c1", organization_id: "org1", instagram_url: "@x" },
    ]);
    getSnapshotSeRecenteMock.mockResolvedValue({ id: "snap1" });
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.skipped).toBe(1);
    expect(fetchProfileSnapshotMock).not.toHaveBeenCalled();
  });

  it("scrapeia e insere quando sem snapshot recente", async () => {
    listClientesParaCronMock.mockResolvedValue([
      { id: "c1", organization_id: "org1", instagram_url: "@x" },
    ]);
    getSnapshotSeRecenteMock.mockResolvedValue(null);
    fetchProfileSnapshotMock.mockResolvedValue({ status: "ok", totalPosts: 100, recentPosts: [] });
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockImplementation(() => ({ insert: insertMock }));

    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.refreshed).toBe(1);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: "c1",
        organization_id: "org1",
        scrape_status: "ok",
        triggered_by: "cron",
      }),
    );
  });
});
