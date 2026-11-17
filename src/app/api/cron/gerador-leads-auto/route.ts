import { NextResponse } from "next/server";
import { executarAutoGerador } from "@/lib/gerador-leads/auto-gerador";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resultados = await executarAutoGerador();

  const resumo = resultados.map((r) => ({
    orgId: r.orgId,
    nichos: r.nichosProcessados,
    novos: r.totalNovos,
    erros: r.erros.length,
  }));

  return NextResponse.json({ ok: true, resultados: resumo });
}
