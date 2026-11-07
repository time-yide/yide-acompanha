import { SITE_URL } from "@/lib/blog/config";
import { postIndexavel } from "@/lib/blog/fora-do-indice";
import { listPostsPublicados } from "@/lib/blog/queries";
import { montarLlmsTxt } from "@/lib/seo/llms";
import { getOrgPadrao, listServicosOuSeed } from "@/lib/seo/queries";
import { listCasesPublicados } from "@/lib/seo/case-queries";

// Dinâmica (não gera no build): usa service-role, cuja env só existe em runtime.
export const dynamic = "force-dynamic";

const MAX_ARTIGOS = 40;

export async function GET() {
  const orgId = await getOrgPadrao();
  const [servicos, posts, cases] = await Promise.all([
    listServicosOuSeed(orgId),
    orgId ? listPostsPublicados(orgId) : Promise.resolve([]),
    orgId ? listCasesPublicados(orgId) : Promise.resolve([]),
  ]);
  const texto = montarLlmsTxt({
    siteUrl: SITE_URL,
    servicos,
    posts: posts.filter((p) => postIndexavel(p.slug)).slice(0, MAX_ARTIGOS),
    cases,
  });
  return new Response(texto, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
