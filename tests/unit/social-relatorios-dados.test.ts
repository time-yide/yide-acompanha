import { describe, it, expect } from "vitest";
import { agregarRelatorio, type PostRaw, type MetricaRaw } from "@/lib/social-media/relatorios/dados";

const posts: PostRaw[] = [
  { id: "p1", legenda: "Post 1", formato: "feed", redes: ["instagram"], midias: ["a.jpg"], publicado_em: "2026-06-02T10:00:00Z" },
  { id: "p2", legenda: "Post 2", formato: "reels", redes: ["instagram", "facebook"], midias: ["b.mp4"], publicado_em: "2026-06-10T10:00:00Z" },
  { id: "p3", legenda: "Post 3", formato: "feed", redes: ["facebook"], midias: [], publicado_em: "2026-06-20T10:00:00Z" },
];

const metricas: MetricaRaw[] = [
  // p1: ig + fb somam
  { post_id: "p1", metrica: "alcance", valor: 100 },
  { post_id: "p1", metrica: "engajamento", valor: 10 },
  // p2 (mais engajamento)
  { post_id: "p2", metrica: "alcance", valor: 500 },
  { post_id: "p2", metrica: "engajamento", valor: 80 },
  // p3 sem métricas
];

describe("agregarRelatorio", () => {
  const r = agregarRelatorio(posts, metricas);

  it("conta os posts", () => {
    expect(r.totais.posts).toBe(3);
  });

  it("soma os totais de alcance e engajamento", () => {
    expect(r.totais.alcance).toBe(600);
    expect(r.totais.engajamento).toBe(90);
  });

  it("post sem métrica vem com zeros", () => {
    const p3 = r.posts.find((p) => p.id === "p3")!;
    expect(p3.alcance).toBe(0);
    expect(p3.engajamento).toBe(0);
  });

  it("thumb = primeira mídia (ou null)", () => {
    expect(r.posts.find((p) => p.id === "p1")!.thumb).toBe("a.jpg");
    expect(r.posts.find((p) => p.id === "p3")!.thumb).toBeNull();
  });

  it("topPosts ordenado por engajamento (p2 primeiro)", () => {
    expect(r.topPosts[0].id).toBe("p2");
    expect(r.topPosts.length).toBeLessThanOrEqual(3);
  });
});
