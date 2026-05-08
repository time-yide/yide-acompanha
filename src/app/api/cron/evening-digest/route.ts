import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { detectEventsTomorrow } from "@/lib/cron/detectors/evento-calendario-amanha";
import type { Json } from "@/types/database";

export const dynamic = "force-dynamic";

interface Counters { evento_calendario_amanha: number }

/**
 * Roda 1x/dia às 21:00 UTC (18:00 BRT). Idempotente: registra em cron_runs
 * com run_date = hoje em BRT. Re-execução no mesmo dia retorna skipped.
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const today = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from("cron_runs")
    .select("ran_at")
    .eq("job_name", "evening-digest")
    .eq("run_date", today)
    .maybeSingle();
  if (existing) return NextResponse.json({ skipped: true, reason: "already ran today" });

  await supabase.from("cron_runs").insert({ job_name: "evening-digest", run_date: today });

  const counters: Counters = { evento_calendario_amanha: 0 };
  try {
    await detectEventsTomorrow(counters);
  } catch (e) {
    console.error("[evening-digest] failure:", e);
  }

  await supabase
    .from("cron_runs")
    .update({ details: counters as unknown as Json })
    .eq("job_name", "evening-digest")
    .eq("run_date", today);

  return NextResponse.json({ counters, ran_at: new Date().toISOString() });
}
