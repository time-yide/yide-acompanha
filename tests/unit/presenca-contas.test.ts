import { describe, it, expect } from "vitest";
import {
  montarContasPorCanal,
  type ClienteYide,
  type PostformeAccountRow,
} from "@/lib/presenca/contas";

const clienteBase: ClienteYide = {
  id: "yide-1",
  nome: "Yide",
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

  it("mapeia a conta do outstand pro gmn e usa gmn_url como link", () => {
    const cliente: ClienteYide = { ...clienteBase, gmn_url: "https://maps.google.com/yide" };
    const res = montarContasPorCanal({
      cliente,
      postforme: [],
      outstand: [{ plataforma: "google_business", account_id: "loc-1", username: "Yide Digital" }],
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
    });
    const li = res.find((r) => r.canal === "linkedin")!;
    expect(li.conectado).toBe(false);
    expect(li.conta).toBeNull();
    expect(li.metricas).toBeNull();
  });

  it("metricas retorna null para todos os canais (social media removido)", () => {
    const res = montarContasPorCanal({
      cliente: clienteBase,
      postforme: [{ plataforma: "instagram", account_id: "a", username: "@ig" }],
      outstand: [],
    });
    const ig = res.find((r) => r.canal === "instagram")!;
    expect(ig.metricas).toBeNull();
  });
});
