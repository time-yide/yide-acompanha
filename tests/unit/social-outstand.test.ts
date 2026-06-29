import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  process.env.OUTSTAND_API_KEY = "k";
});

describe("publicarOutstand", () => {
  it("monta o request certo (containers + socialAccountIds + media) e retorna id", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: "post_1" }) });
    const { publicarOutstand } = await import("@/lib/social-media/outstand");
    const r = await publicarOutstand({ accountIds: ["acc_1"], content: "oi", mediaUrls: ["a.jpg"] });
    expect(r.data?.id).toBe("post_1");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.socialAccountIds).toEqual(["acc_1"]);
    expect(body.containers).toEqual([{ content: "oi" }]);
    expect(body.media).toEqual([{ url: "a.jpg" }]);
  });

  it("erro da API → retorna error", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: "bad" }) });
    const { publicarOutstand } = await import("@/lib/social-media/outstand");
    const r = await publicarOutstand({ accountIds: ["acc_1"], content: "x", mediaUrls: [] });
    expect(r.error).toBe("bad");
  });

  it("sem contas → erro sem chamar a API", async () => {
    const { publicarOutstand } = await import("@/lib/social-media/outstand");
    const r = await publicarOutstand({ accountIds: [], content: "x", mediaUrls: [] });
    expect(r.error).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sem OUTSTAND_API_KEY → erro amigável", async () => {
    delete process.env.OUTSTAND_API_KEY;
    const { publicarOutstand } = await import("@/lib/social-media/outstand");
    const r = await publicarOutstand({ accountIds: ["acc_1"], content: "x", mediaUrls: [] });
    expect(r.error).toMatch(/OUTSTAND_API_KEY/);
  });
});
