import { describe, it, expect, vi, beforeEach } from "vitest";

const { metaFetch } = vi.hoisted(() => ({ metaFetch: vi.fn() }));
vi.mock("@/lib/social-media/meta-publish", () => ({ metaFetch }));

import {
  getInstagramMediaInsights,
  getFacebookPostInsights,
} from "@/lib/social-media/meta-insights";
import { formatCompact } from "@/lib/social-media/format";

beforeEach(() => metaFetch.mockReset());

describe("getInstagramMediaInsights", () => {
  it("mapeia a resposta do IG pras chaves em português", async () => {
    metaFetch.mockResolvedValueOnce({
      data: {
        data: [
          { name: "reach", values: [{ value: 1200 }] },
          { name: "likes", values: [{ value: 234 }] },
          { name: "comments", values: [{ value: 12 }] },
          { name: "saved", values: [{ value: 18 }] },
          { name: "shares", values: [{ value: 5 }] },
          { name: "total_interactions", values: [{ value: 269 }] },
        ],
      },
    });
    const r = await getInstagramMediaInsights("media1");
    expect(r).toEqual({
      metricas: { alcance: 1200, curtidas: 234, comentarios: 12, salvamentos: 18, compartilhamentos: 5, engajamento: 269 },
    });
  });

  it("tolera métricas ausentes (grava só as que vieram)", async () => {
    metaFetch.mockResolvedValueOnce({
      data: { data: [{ name: "reach", values: [{ value: 100 }] }] },
    });
    const r = await getInstagramMediaInsights("media1");
    expect(r).toEqual({ metricas: { alcance: 100 } });
  });

  it("repassa erro do Meta", async () => {
    metaFetch.mockResolvedValueOnce({ error: "permissão faltando" });
    const r = await getInstagramMediaInsights("media1");
    expect(r).toHaveProperty("error");
  });
});

describe("getFacebookPostInsights", () => {
  it("mapeia reações/comentários/compartilhamentos + alcance", async () => {
    metaFetch.mockResolvedValueOnce({
      data: {
        reactions: { summary: { total_count: 80 } },
        comments: { summary: { total_count: 9 } },
        shares: { count: 4 },
      },
    });
    metaFetch.mockResolvedValueOnce({
      data: { data: [{ name: "post_impressions_unique", values: [{ value: 900 }] }] },
    });
    const r = await getFacebookPostInsights("post1");
    expect(r).toEqual({
      metricas: { curtidas: 80, comentarios: 9, compartilhamentos: 4, alcance: 900 },
    });
  });
});

describe("formatCompact", () => {
  it("formata números grandes", () => {
    expect(formatCompact(1234)).toBe("1.2K");
    expect(formatCompact(999)).toBe("999");
    expect(formatCompact(1500000)).toBe("1.5M");
  });
});
