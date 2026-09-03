import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { WeeklyReportRow } from "./types";

export async function listWeeklyReportsByClient(
  clientId: string,
  limit: number = 8
): Promise<WeeklyReportRow[]> {
  const sb = createServiceRoleClient();
  const sbAny = sb as any;
  const { data, error } = await sbAny
    .from("weekly_reports")
    .select("*")
    .eq("client_id", clientId)
    .order("semana_inicio", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as WeeklyReportRow[];
}
