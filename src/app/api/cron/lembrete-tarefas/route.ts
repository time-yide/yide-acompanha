import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getTodayDate } from "@/lib/datetime/timezone";
import { sendLembretesTarefas } from "@/lib/lembrete-tarefas/send";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const today = getTodayDate();
  const hour = new Date().toLocaleString("en-US", { timeZone: "America/Cuiaba", hour: "2-digit", hour12: false });
  const jobKey = `lembrete-tarefas-${hour}`;

  const { data: existing } = await supabase
    .from("cron_runs")
    .select("ran_at")
    .eq("job_name", jobKey)
    .eq("run_date", today)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ skipped: true, reason: "already ran this slot" });
  }

  await supabase.from("cron_runs").insert({ job_name: jobKey, run_date: today });

  const results = await sendLembretesTarefas();

  await supabase
    .from("cron_runs")
    .update({ details: results as unknown as import("@/types/database").Json })
    .eq("job_name", jobKey)
    .eq("run_date", today);

  return NextResponse.json({ results, ran_at: new Date().toISOString() });
}
