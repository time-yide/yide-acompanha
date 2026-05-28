// src/app/api/cron/gravacoes-pendentes/route.ts
import { NextResponse } from "next/server";
import { detectGravacoesPendentes } from "@/lib/cron/detectors/gravacoes-pendentes";

export const dynamic = "force-dynamic";

/**
 * Roda a cada 5 min. Idempotência via colunas notif_*_enviada_em no evento.
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const counters = {
    gravacao_pendente_24h: 0,
    gravacao_pendente_3h: 0,
    gravacao_alerta_2h: 0,
    gravacao_sem_roteiro: 0,
  };
  try {
    await detectGravacoesPendentes(counters);
  } catch (e) {
    console.error("[gravacoes-pendentes] failure:", e);
    return NextResponse.json({ error: "internal", counters }, { status: 500 });
  }

  return NextResponse.json({ counters, ran_at: new Date().toISOString() });
}
