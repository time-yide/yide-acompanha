import { NextResponse } from "next/server";
import { logActivityEvent } from "@/lib/produtividade/actions";
import { logEventSchema } from "@/lib/produtividade/schema";

export const dynamic = "force-dynamic";

/**
 * POST /api/produtividade/event
 *
 * Body: { event_type, entity_type?, entity_id?, client_id?, metadata? }
 *
 * Registra 1 linha em activity_events + atualiza last_active_event_at.
 * Best-effort — falha silenciosa do client.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = logEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Input inválido" },
        { status: 400 },
      );
    }
    const r = await logActivityEvent(parsed.data);
    return NextResponse.json(r);
  } catch (err) {
    console.error("[produtividade/event] failed:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
