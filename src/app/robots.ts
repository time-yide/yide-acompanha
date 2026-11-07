import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { SITE_URL } from "@/lib/blog/config";
import { regrasRobots } from "@/lib/site/robots";

// Robots ciente do host: domínio público libera o conteúdo e bloqueia as áreas
// internas; o subdomínio do sistema (sistemaacompanha...) fica fora do índice.
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host") ?? "";
  return regrasRobots(host, SITE_URL);
}
