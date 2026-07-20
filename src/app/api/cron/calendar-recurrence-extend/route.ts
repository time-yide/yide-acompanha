import { NextResponse } from "next/server";
import { runCalendarRecurrenceExtend } from "@/lib/cron/detectors/calendar-recurrence-extend";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runCalendarRecurrenceExtend();
  return NextResponse.json(result);
}
