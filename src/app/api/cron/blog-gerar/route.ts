import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getOrgPadraoBlog } from "@/lib/blog/queries";
import { executarPipelineBlog, BLOG_POSTS_POR_EXECUCAO } from "@/lib/blog/pipeline/executar";
import { executarPipelineEstrategico } from "@/lib/blog/pipeline/executar-estrategico";
import { gerarTendencias } from "@/lib/blog/pipeline/tendencias";

/**
 * Cron: gera e PUBLICA 3 posts de blog por dia via IA, sem revisão. Mix diário:
 * 2 notícia (RSS) + 1 estratégico (banco de temas, GEO/EEAT); se faltar um tipo,
 * o outro completa. Claude escreve o texto original em pt-br e a capa vem do Pexels.
 * Os botões de gerar na tela do Blog continuam criando rascunho.
 *
 * Schedule (vercel.json): 0 10 * * * (10h UTC = 7h Cuiabá).
 * Autenticado por CRON_SECRET. Best-effort: falha de item não derruba o cron.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const orgId = await getOrgPadraoBlog();
  if (!orgId) return NextResponse.json({ error: "sem organização" }, { status: 500 });

  const r = await executarPipelineBlog(orgId, 2, true); // 2 notícia
  const est = await executarPipelineEstrategico(orgId, BLOG_POSTS_POR_EXECUCAO - r.gerados, true); // 1 estratégico + o que faltou de notícia
  if (r.gerados + est.gerados > 0) revalidatePath("/blog");
  // Atualiza o ranking de "Assuntos em alta" (best-effort; não derruba o cron).
  const trend = await gerarTendencias(orgId).catch((e) => {
    console.error("[cron blog] tendências:", e);
    return { ok: false, total: 0 };
  });
  return NextResponse.json({ ok: true, ...r, estrategico: est, tendencias: trend.total });
}
