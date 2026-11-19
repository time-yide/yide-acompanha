import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getOrgPadraoBlog } from "@/lib/blog/queries";
import { executarPipelineEstrategico } from "@/lib/blog/pipeline/executar-estrategico";
import { gerarTendencias } from "@/lib/blog/pipeline/tendencias";
import { avisarBuscadores } from "@/lib/blog/indexnow";

/**
 * Cron: gera e PUBLICA 1 post de blog por dia via IA, sem revisão (era 3: volume alto
 * de texto gerado arrisca a política de conteúdo em escala do Google). O post vem do
 * banco de temas estratégicos (perguntas de empresário, GEO/EEAT): o blog é pra atrair
 * dono de empresa, não leitor aleatório. Notícia (RSS) não entra mais (só pelos botões da tela do Blog, como rascunho). Claude escreve o texto original em pt-br e a capa vem do Pexels.
 * Os botões de gerar na tela do Blog continuam criando rascunho.
 *
 * Schedule (vercel.json): 0 10 * * * (10h UTC = 7h Cuiabá).
 * Autenticado por CRON_SECRET. Best-effort: falha de item não derruba o cron.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Quantos artigos o cron publica por dia. */
const BLOG_POSTS_CRON_POR_DIA = 1;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const orgId = await getOrgPadraoBlog();
  if (!orgId) return NextResponse.json({ error: "sem organização" }, { status: 500 });

  // Só temas de empresário (é o que traz cliente e é citado pelas IAs). Notícia genérica
  // (RSS) não entra mais no blog: se acabar tema, o dia fica sem post.
  const est = await executarPipelineEstrategico(orgId, BLOG_POSTS_CRON_POR_DIA, true);
  if (est.gerados > 0) revalidatePath("/blog");
  await avisarBuscadores(est.publicados);
  // Atualiza o ranking de "Assuntos em alta" (best-effort; não derruba o cron).
  const trend = await gerarTendencias(orgId).catch((e) => {
    console.error("[cron blog] tendências:", e);
    return { ok: false, total: 0 };
  });
  return NextResponse.json({ ok: true, estrategico: est, tendencias: trend.total });
}
