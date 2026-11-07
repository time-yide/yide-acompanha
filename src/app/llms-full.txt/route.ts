import { SITE_URL } from "@/lib/blog/config";
import { postIndexavel } from "@/lib/blog/fora-do-indice";
import { listPostsPublicados } from "@/lib/blog/queries";
import { getOrgPadrao } from "@/lib/seo/queries";
import { listCasesPublicados } from "@/lib/seo/case-queries";
import { montarLlmsFull } from "@/lib/site/llms-full";

// Dinâmica (não gera no build): usa service-role, cuja env só existe em runtime.
export const dynamic = "force-dynamic";

const MAX_ARTIGOS = 80;

export async function GET() {
  const orgId = await getOrgPadrao();
  const [posts, cases] = await Promise.all([
    orgId ? listPostsPublicados(orgId) : Promise.resolve([]),
    orgId ? listCasesPublicados(orgId) : Promise.resolve([]),
  ]);
  const texto = montarLlmsFull({
    siteUrl: SITE_URL,
    cases,
    posts: posts.filter((p) => postIndexavel(p.slug)).slice(0, MAX_ARTIGOS),
  });
  return new Response(texto, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
