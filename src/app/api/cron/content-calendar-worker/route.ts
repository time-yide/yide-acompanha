import { NextResponse } from "next/server";
import { processContentCalendars } from "@/lib/content-calendar/worker";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cron worker que processa cronogramas pendentes de geração via IA.
 *
 * Pega até 3 registros pendente_geracao, gera via Claude Sonnet, e
 * marca como gerado ou erro.
 *
 * Auth: header Authorization: Bearer ${CRON_SECRET}.
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processContentCalendars();
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[content-calendar-worker] Erro fatal:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
