import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { SITE_URL } from "@/lib/blog/config";

// Robots ciente do host: no domínio institucional (yidedigital.com.br) libera o
// site público e bloqueia as áreas internas; no subdomínio do sistema
// (sistemaacompanha...) não indexa nada.
export const dynamic = "force-dynamic";

const MARKETING_HOSTS = new Set(["yidedigital.com.br", "www.yidedigital.com.br"]);
const INTERNO = [
  "/programacao", "/clientes", "/cliente", "/login", "/api", "/auth",
  "/aprovacao-design", "/aprovacao-post", "/definir-senha", "/recuperar-senha",
  "/relatorio-redes-sociais-pdf", "/relatorio-trafego-pdf", "/apresenta-yide-pdf",
];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host") ?? "";
  if (!MARKETING_HOSTS.has(host)) {
    // Sistema interno: fora do índice.
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: INTERNO }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
