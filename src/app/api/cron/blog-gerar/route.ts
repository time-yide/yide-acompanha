import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getOrgPadraoBlog } from "@/lib/blog/queries";
import { executarPipelineBlog, BLOG_POSTS_POR_EXECUCAO } from "@/lib/blog/pipeline/executar";
import { executarPipelineEstrategico } from "@/lib/blog/pipeline/executar-estrategico";
import { gerarTendencias } from "@/lib/blog/pipeline/tendencias";
import { avisarBuscadores } from "@/lib/blog/indexnow";

/**
 * Cron: gera e PUBLICA 3 posts de blog por dia via IA, sem revisão. Os 3 vêm do
 * banco de temas estratégicos (perguntas de empresário, GEO/EEAT): o blog é pra atrair
 * dono de empresa, não leitor aleatório. Notícia (RSS) só completa o dia se acabar tema. Claude escreve o texto original em pt-br e a capa vem do Pexels.
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

  // Só temas de empresário (é o que traz cliente e é citado pelas IAs); notícia só se acabar tema.
  const est = await executarPipelineEstrategico(orgId, BLOG_POSTS_POR_EXECUCAO, true);
  const r = await executarPipelineBlog(orgId, BLOG_POSTS_POR_EXECUCAO - est.gerados, true);
  if (r.gerados + est.gerados > 0) revalidatePath("/blog");
  await avisarBuscadores([...r.publicados, ...est.publicados]);
  // Atualiza o ranking de "Assuntos em alta" (best-effort; não derruba o cron).
  const trend = await gerarTendencias(orgId).catch((e) => {
    console.error("[cron blog] tendências:", e);
    return { ok: false, total: 0 };
  });
  return NextResponse.json({ ok: true, ...r, estrategico: est, tendencias: trend.total });
}
