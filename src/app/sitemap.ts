import type { MetadataRoute } from "next";
import { getOrgPadraoBlog, listPostsPublicados } from "@/lib/blog/queries";
import { SITE_URL } from "@/lib/blog/config";

// Dinâmica (não gera no build): usa service-role, cuja env só existe em runtime.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const orgId = await getOrgPadraoBlog();
  const posts = orgId ? await listPostsPublicados(orgId) : [];
  return [
    { url: `${SITE_URL}/blog`, changeFrequency: "daily", priority: 0.8 },
    ...posts.map((p) => ({
      url: `${SITE_URL}/blog/${p.slug}`,
      lastModified: p.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
