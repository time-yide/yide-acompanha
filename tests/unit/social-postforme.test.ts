import { describe, it, expect, vi, beforeEach } from "vitest";
import { validarFormatoPorRede } from "@/lib/social-media/postforme-validate";

describe("validarFormatoPorRede", () => {
  it("TikTok sem vídeo → erro", () => {
    expect(validarFormatoPorRede(["tiktok"], ["a.jpg"])).toMatch(/TikTok/);
  });
  it("YouTube com vídeo → ok", () => {
    expect(validarFormatoPorRede(["youtube"], ["v.mp4"])).toBeNull();
  });
  it("LinkedIn com imagem → ok", () => {
    expect(validarFormatoPorRede(["linkedin"], ["a.jpg"])).toBeNull();
  });
  it("TikTok com vídeo (query string) → ok", () => {
    expect(validarFormatoPorRede(["tiktok"], ["https://x/v.mp4?token=1"])).toBeNull();
  });
});

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  process.env.POST_FOR_ME_API_KEY = "k";
});

describe("publicarPostforme", () => {
  it("monta o request certo e retorna id", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: "sp_1" }) });
    const { publicarPostforme } = await import("@/lib/social-media/postforme");
    const r = await publicarPostforme({ accountIds: ["sa_1"], caption: "oi", mediaUrls: ["v.mp4"] });
    expect(r.data?.id).toBe("sp_1");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.social_accounts).toEqual(["sa_1"]);
    expect(body.media).toEqual([{ url: "v.mp4" }]);
    expect(body.caption).toBe("oi");
  });

  it("erro da API → retorna error", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: "bad" }) });
    const { publicarPostforme } = await import("@/lib/social-media/postforme");
    const r = await publicarPostforme({ accountIds: ["sa_1"], caption: "x", mediaUrls: [] });
    expect(r.error).toBe("bad");
  });

  it("sem contas → erro sem chamar a API", async () => {
    const { publicarPostforme } = await import("@/lib/social-media/postforme");
    const r = await publicarPostforme({ accountIds: [], caption: "x", mediaUrls: [] });
    expect(r.error).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
