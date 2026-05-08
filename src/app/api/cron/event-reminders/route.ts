import { NextResponse } from "next/server";
import { detectEventsIn30Min } from "@/lib/cron/detectors/evento-calendario-30min";

export const dynamic = "force-dynamic";

/**
 * Roda a cada 5 min (Vercel cron "*\/5 * * * *").
 * Idempotência por evento via reminded_30min_at, não por dia — então
 * não usamos cron_runs aqui.
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const counters = { evento_calendario_30min: 0 };
  try {
    await detectEventsIn30Min(counters);
  } catch (e) {
    console.error("[event-reminders] failure:", e);
    return NextResponse.json({ error: "internal", counters }, { status: 500 });
  }

  return NextResponse.json({ counters, ran_at: new Date().toISOString() });
}
