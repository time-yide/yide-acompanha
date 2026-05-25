import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({ APIFY_API_TOKEN: "test-token" }),
}));

import { normalizeUsername, fetchProfileSnapshot } from "@/lib/instagram-snapshots/scraper";

describe("normalizeUsername", () => {
  it("aceita username puro", () => {
    expect(normalizeUsername("yidedigital")).toBe("yidedigital");
  });
  it("remove @", () => {
    expect(normalizeUsername("@yidedigital")).toBe("yidedigital");
  });
  it("extrai de URL", () => {
    expect(normalizeUsername("https://instagram.com/yidedigital/")).toBe("yidedigital");
  });
  it("extrai de URL com query", () => {
    expect(normalizeUsername("https://www.instagram.com/yidedigital/?utm=1")).toBe("yidedigital");
  });
  it("retorna null para string vazia", () => {
    expect(normalizeUsername("")).toBeNull();
    expect(normalizeUsername("   ")).toBeNull();
  });
  it("retorna null para null/undefined", () => {
    expect(normalizeUsername(null)).toBeNull();
    expect(normalizeUsername(undefined)).toBeNull();
  });
});

describe("fetchProfileSnapshot — retry transitório", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    // Encurta o delay de retry pra teste rodar rápido. Sem isso o setTimeout
    // de 3s da função real seria fake-clocked, mas é mais simples avançar timers.
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("re-tenta quando 1º try retorna no_items (array vazio) e usa resultado do 2º", async () => {
    // 1º: array vazio (no_items, transitório) → 2º: posts válidos
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
        text: async () => "",
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          { url: "https://instagram.com/p/X1/", timestamp: "2026-05-20T10:00:00Z", type: "Image" },
          { url: "https://instagram.com/p/X2/", timestamp: "2026-05-21T10:00:00Z", type: "Video", productType: "clips" },
        ],
        text: async () => "",
      });

    const promise = fetchProfileSnapshot("https://instagram.com/nazcasushi/");
    // Avança o sleep(3000) entre tentativas
    await vi.advanceTimersByTimeAsync(3500);
    const result = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("ok");
    expect(result.recentPosts).toHaveLength(2);
    expect(result.recentPosts[1].type).toBe("reel");
  });

  it("NÃO re-tenta quando perfil retorna 1 item com error explícito (determinístico)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [{ error: "invalid_username" }],
      text: async () => "",
    });

    const result = await fetchProfileSnapshot("perfil-invalido");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("profile_not_found");
    expect(result.erro).toBe("invalid_username");
  });

  it("re-tenta quando 1º try é HTTP 503 (servidor Apify) e devolve resultado do 2º", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({}),
        text: async () => "service unavailable",
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          { shortCode: "abc", timestamp: "2026-05-20T10:00:00Z", type: "Image" },
        ],
        text: async () => "",
      });

    const promise = fetchProfileSnapshot("yidedigital");
    await vi.advanceTimersByTimeAsync(3500);
    const result = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("ok");
    expect(result.recentPosts[0].url).toBe("https://www.instagram.com/p/abc/");
  });

  it("NÃO re-tenta HTTP 403 (limite de uso — determinístico, retry não muda nada)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({}),
      text: async () => "Monthly usage hard limit exceeded",
    });

    const result = await fetchProfileSnapshot("yidedigital");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("error");
    expect(result.erro).toMatch(/403/);
  });

  it("se as duas tentativas falharem com no_items, devolve no_items final (não trava em loop)", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [], text: async () => "" })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [], text: async () => "" });

    const promise = fetchProfileSnapshot("yidedigital");
    await vi.advanceTimersByTimeAsync(3500);
    const result = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("profile_not_found");
    expect(result.erro).toBe("no_items");
  });
});
