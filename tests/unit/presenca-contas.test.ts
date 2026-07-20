import { describe, it, expect } from "vitest";
import {
  montarContasPorCanal,
  type ClienteYide,
  type PostformeAccountRow,
  type MetricaRow,
  type PostRedeRow,
} from "@/lib/presenca/contas";

const clienteBase: ClienteYide = {
  id: "yide-1",
  nome: "Yide",
  instagram_business_id: null,
  facebook_page_id: null,
  gmn_location_id: null,
  gmn_url: null,
};

describe("montarContasPorCanal", () => {
  it("mapeia contas do postforme pros canais certos", () => {
    const postforme: PostformeAccountRow[] = [
      { plataforma: "instagram", account_id: "acc-ig", username: "@yide.ig" },
      { plataforma: "facebook", account_id: "acc-fb", username: "Yide FB" },
      { plataforma: "linkedin", account_id: "acc-li", username: "yide-company" },
      { plataforma: "tiktok", account_id: "acc-tk", username: "@yidetok" },
      { plataforma: "youtube", account_id: "acc-yt", username: "Yide TV" },
    ];
    const res = montarContasPorCanal({
      cliente: clienteBase,
      postforme,
      outstand: [],
      posts: [],
      metricas: [],
    });
    const byCanal = Object.fromEntries(res.map((r) => [r.canal, r]));

    expect(byCanal.instagram.conectado).toBe(true);
    expect(byCanal.instagram.conta).toBe("@yide.ig");
    expect(byCanal.facebook.conta).toBe("Yide FB");
    expect(byCanal.linkedin.conta).toBe("yide-company");
    expect(byCanal.tiktok.conta).toBe("@yidetok");
    expect(byCanal.youtube.conta).toBe("Yide TV");
    expect(byCanal.youtube.conectado).toBe(true);
  });

  it("usa o modo nativo do Meta (clients) quando não há postforme", () => {
    const cliente: ClienteYide = {
      ...clienteBase,
      instagram_business_id: "1789",
      facebook_page_id: "page-42",
    };
    const res = montarContasPorCanal({
      cliente,
      postforme: [],
      outstand: [],
      posts: [],
      metricas: [],
    });
    const byCanal = Object.fromEntries(res.map((r) => [r.canal, r]));
    expect(byCanal.instagram.conectado).toBe(true);
    expect(byCanal.instagram.conta).toBe("1789");
    expect(byCanal.facebook.conectado).toBe(true);
    expect(byCanal.facebook.conta).toBe("page-42");
  });

  it("postforme tem prioridade sobre o modo nativo do Meta pro username", () => {
    const cliente: ClienteYide = { ...clienteBase, instagram_business_id: "1789" };
    const res = montarContasPorCanal({
      cliente,
      postforme: [{ plataforma: "instagram", account_id: "acc-ig", username: "@yide.ig" }],
      outstand: [],
      posts: [],
      metricas: [],
    });
    const ig = res.find((r) => r.canal === "instagram")!;
    expect(ig.conta).toBe("@yide.ig");
  });

  it("mapeia a conta do outstand pro gmn e usa gmn_url como link", () => {
    const cliente: ClienteYide = { ...clienteBase, gmn_url: "https://maps.google.com/yide" };
    const res = montarContasPorCanal({
      cliente,
      postforme: [],
      outstand: [{ plataforma: "google_business", account_id: "loc-1", username: "Yide Digital" }],
      posts: [],
      metricas: [],
    });
    const gmn = res.find((r) => r.canal === "gmn")!;
    expect(gmn.conectado).toBe(true);
    expect(gmn.conta).toBe("Yide Digital");
    expect(gmn.link).toBe("https://maps.google.com/yide");
  });

  it("gmn conecta pelo gmn_location_id do cliente quando não há outstand", () => {
    const cliente: ClienteYide = { ...clienteBase, gmn_location_id: "locations/123" };
    const res = montarContasPorCanal({
      cliente,
      postforme: [],
      outstand: [],
      posts: [],
      metricas: [],
    });
    const gmn = res.find((r) => r.canal === "gmn")!;
    expect(gmn.conectado).toBe(true);
    expect(gmn.conta).toBe("locations/123");
  });

  it("marca threads, pinterest e medium como conexão manual", () => {
    const res = montarContasPorCanal({
      cliente: clienteBase,
      postforme: [],
      outstand: [],
      posts: [],
      metricas: [],
    });
    const byCanal = Object.fromEntries(res.map((r) => [r.canal, r]));
    for (const canal of ["threads", "pinterest", "medium"] as const) {
      expect(byCanal[canal].manual).toBe(true);
      expect(byCanal[canal].conectado).toBe(false);
      expect(byCanal[canal].metricas).toBeNull();
    }
    // canais conectáveis não são manuais
    expect(byCanal.instagram.manual).toBe(false);
    expect(byCanal.gmn.manual).toBe(false);
  });

  it("canais sem conta ficam desconectados e sem métricas", () => {
    const res = montarContasPorCanal({
      cliente: clienteBase,
      postforme: [],
      outstand: [],
      posts: [],
      metricas: [],
    });
    const li = res.find((r) => r.canal === "linkedin")!;
    expect(li.conectado).toBe(false);
    expect(li.conta).toBeNull();
    expect(li.metricas).toBeNull();
  });

  it("agrega métricas por rede pros posts publicados do IG/FB", () => {
    const posts: PostRedeRow[] = [
      { id: "p1", redes: ["instagram", "facebook"], status: "publicado" },
      { id: "p2", redes: ["instagram"], status: "publicado" },
      { id: "p3", redes: ["instagram"], status: "rascunho" }, // ignorado (não publicado)
      { id: "p4", redes: ["linkedin"], status: "publicado" }, // linkedin não tem métricas neste v1
    ];
    const metricas: MetricaRow[] = [
      { post_id: "p1", rede: "instagram", metrica: "alcance", valor: 100 },
      { post_id: "p1", rede: "instagram", metrica: "curtidas", valor: 10 },
      { post_id: "p1", rede: "instagram", metrica: "comentarios", valor: 2 },
      { post_id: "p1", rede: "facebook", metrica: "alcance", valor: 50 },
      { post_id: "p1", rede: "facebook", metrica: "compartilhamentos", valor: 3 },
      { post_id: "p2", rede: "instagram", metrica: "alcance", valor: 200 },
      { post_id: "p2", rede: "instagram", metrica: "salvamentos", valor: 5 },
      { post_id: "p3", rede: "instagram", metrica: "alcance", valor: 999 }, // post não publicado, ignorado
    ];
    const res = montarContasPorCanal({
      cliente: clienteBase,
      postforme: [{ plataforma: "instagram", account_id: "a", username: "@ig" }],
      outstand: [],
      posts,
      metricas,
    });
    const byCanal = Object.fromEntries(res.map((r) => [r.canal, r]));

    // IG: 2 posts publicados (p1, p2); alcance 100+200=300; interações 10+2+5=17
    expect(byCanal.instagram.metricas).toEqual({ posts: 2, alcance: 300, interacoes: 17 });
    // FB: 1 post publicado (p1); alcance 50; interações 3
    expect(byCanal.facebook.metricas).toEqual({ posts: 1, alcance: 50, interacoes: 3 });
    // LinkedIn: sem métricas neste v1 (fica null)
    expect(byCanal.linkedin.metricas).toBeNull();
  });

  it("IG/FB sem posts publicados retornam métricas zeradas (não null)", () => {
    const res = montarContasPorCanal({
      cliente: clienteBase,
      postforme: [{ plataforma: "instagram", account_id: "a", username: "@ig" }],
      outstand: [],
      posts: [],
      metricas: [],
    });
    const ig = res.find((r) => r.canal === "instagram")!;
    expect(ig.metricas).toEqual({ posts: 0, alcance: 0, interacoes: 0 });
  });
});
