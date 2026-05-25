import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());
const requireAuthMock = vi.hoisted(() => vi.fn());
const fetchProfileSnapshotMock = vi.hoisted(() => vi.fn());
const getSnapshotSeRecenteMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));
vi.mock("@/lib/auth/session", () => ({ requireAuth: requireAuthMock }));
vi.mock("@/lib/instagram-snapshots/scraper", () => ({
  fetchProfileSnapshot: fetchProfileSnapshotMock,
}));
vi.mock("@/lib/instagram-snapshots/queries", () => ({
  getSnapshotSeRecente: getSnapshotSeRecenteMock,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { refreshSnapshotsAction } from "@/lib/instagram-snapshots/actions";

beforeEach(() => {
  fromMock.mockReset();
  requireAuthMock.mockReset();
  fetchProfileSnapshotMock.mockReset();
  getSnapshotSeRecenteMock.mockReset();
});

describe("refreshSnapshotsAction", () => {
  it("rejeita sem permissão", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "videomaker" });
    const r = await refreshSnapshotsAction(["00000000-0000-0000-0000-000000000001"]);
    expect("error" in r ? r.error : null).toMatch(/permissão/i);
  });

  it("filtra pacotes inelegíveis", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "socio" });
    fromMock.mockImplementation(() => ({
      select: () => ({
        in: vi.fn().mockResolvedValue({
          data: [
            { id: "c1", organization_id: "org1", tipo_pacote: "trafego", instagram_url: "x", assessor_id: null },
            { id: "c2", organization_id: "org1", tipo_pacote: "audiovisual", instagram_url: "y", assessor_id: null },
          ],
        }),
      }),
    }));

    const r = await refreshSnapshotsAction(["c1", "c2"]);
    expect("total" in r ? r.total : -1).toBe(0);
    expect(fetchProfileSnapshotMock).not.toHaveBeenCalled();
  });

  it("usa cache 5min quando 1 client", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "socio" });
    fromMock.mockImplementation(() => ({
      select: () => ({
        in: vi.fn().mockResolvedValue({
          data: [{ id: "c1", organization_id: "org1", tipo_pacote: "yide_360", instagram_url: "@x", assessor_id: null }],
        }),
      }),
    }));
    getSnapshotSeRecenteMock.mockResolvedValue({ id: "snap1" });

    const r = await refreshSnapshotsAction(["c1"]);
    expect("cached" in r ? r.cached : -1).toBe(1);
    expect(fetchProfileSnapshotMock).not.toHaveBeenCalled();
  });

  it("assessor só refresha clientes próprios", async () => {
    requireAuthMock.mockResolvedValue({ id: "u_assessor", role: "assessor" });
    fromMock.mockImplementation(() => ({
      select: () => ({
        in: vi.fn().mockResolvedValue({
          data: [
            { id: "c1", organization_id: "org1", tipo_pacote: "yide_360", instagram_url: "@x", assessor_id: "u_assessor" },
            { id: "c2", organization_id: "org1", tipo_pacote: "yide_360", instagram_url: "@y", assessor_id: "outro" },
          ],
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    }));
    getSnapshotSeRecenteMock.mockResolvedValue(null);
    fetchProfileSnapshotMock.mockResolvedValue({ status: "ok", totalPosts: 100, recentPosts: [] });

    const r = await refreshSnapshotsAction(["c1", "c2"]);
    expect("total" in r ? r.total : -1).toBe(1);
    expect(fetchProfileSnapshotMock).toHaveBeenCalledTimes(1);
  });
});
