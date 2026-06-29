import { NextResponse } from "next/server";
import { sincronizarMetricasPendentes } from "@/lib/social-media/insights-sync";

export const dynamic = "force-dynamic";

/**
 * Cron de coleta de métricas dos posts publicados (IG/FB).
 * Roda 3x/dia via vercel.json. Auth: Authorization: Bearer ${CRON_SECRET}.
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const r = await sincronizarMetricasPendentes(50);
  return NextResponse.json({ success: true, ...r });
}
