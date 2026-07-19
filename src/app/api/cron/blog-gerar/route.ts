import { NextResponse, type NextRequest } from "next/server";
import { getOrgPadraoBlog } from "@/lib/blog/queries";
import { executarPipelineBlog } from "@/lib/blog/pipeline/executar";

/**
 * Cron: gera 2–3 rascunhos de blog por dia a partir de notícias (RSS) via IA
 * (Claude escreve original em pt-br + gpt-image-1 faz a capa). Os posts entram
 * como RASCUNHO — a Programação revisa e publica. Nada vai pro ar automaticamente.
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

  const r = await executarPipelineBlog(orgId);
  return NextResponse.json({ ok: true, ...r });
}
