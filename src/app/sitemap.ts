import type { MetadataRoute } from "next";
import { listPostsPublicados } from "@/lib/blog/queries";
import { getOrgPadrao, listServicosComPaginas, listPaginasPublicadasDoServico } from "@/lib/seo/queries";
import { listCasesPublicados } from "@/lib/seo/case-queries";
import { SITE_URL } from "@/lib/blog/config";

// Dinâmica (não gera no build): usa service-role, cuja env só existe em runtime.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const orgId = await getOrgPadrao();
  const [posts, servicos, cases] = await Promise.all([
    orgId ? listPostsPublicados(orgId) : Promise.resolve([]),
    orgId ? listServicosComPaginas(orgId) : Promise.resolve([]),
    orgId ? listCasesPublicados(orgId) : Promise.resolve([]),
  ]);

  // Páginas serviço × localidade publicadas (uma consulta por serviço).
  const paginasServico = orgId
    ? (await Promise.all(
        servicos.map((s) =>
          listPaginasPublicadasDoServico(orgId, s.slug).then((ps) => ps.map((p) => `${s.slug}/${p.localidadeSlug}`)),
        ),
      )).flat()
    : [];

  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/servicos`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/cases`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/blog`, changeFrequency: "daily", priority: 0.8 },
    ...servicos.map((s) => ({ url: `${SITE_URL}/servicos/${s.slug}`, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...paginasServico.map((path) => ({ url: `${SITE_URL}/servicos/${path}`, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...cases.map((c) => ({ url: `${SITE_URL}/cases/${c.slug}`, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...posts.map((p) => ({ url: `${SITE_URL}/blog/${p.slug}`, lastModified: p.updated_at, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
