import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/blog/config";

// Libera o blog público pra indexação; bloqueia o resto do app (sistema interno).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/blog"], disallow: "/" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
