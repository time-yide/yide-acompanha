import { NextResponse } from "next/server";
import { heartbeatAction } from "@/lib/produtividade/actions";

export const dynamic = "force-dynamic";

/**
 * POST /api/produtividade/heartbeat
 *
 * Body: vazio. Chamado pelo HeartbeatProvider a cada ~30s enquanto a aba
 * estiver aberta e visível. Atualiza profiles.last_seen_at.
 *
 * Não registra evento (não polui activity_events com pings).
 */
export async function POST() {
  try {
    const r = await heartbeatAction();
    return NextResponse.json(r);
  } catch (err) {
    console.error("[heartbeat] failed:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
