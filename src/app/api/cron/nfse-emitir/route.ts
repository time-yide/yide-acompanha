import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getTodayDate } from "@/lib/datetime/timezone";
import { emitirNfseAutomatico } from "@/lib/nfse/emitir";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const today = getTodayDate();

  const { data: existing } = await supabase
    .from("cron_runs")
    .select("ran_at")
    .eq("job_name", "nfse-emitir")
    .eq("run_date", today)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ skipped: true, reason: "already ran today" });
  }

  await supabase.from("cron_runs").insert({ job_name: "nfse-emitir", run_date: today });

  const result = await emitirNfseAutomatico();
  return NextResponse.json(result);
}
