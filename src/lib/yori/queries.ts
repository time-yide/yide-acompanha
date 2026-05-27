// SERVER ONLY
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { YoriJob, YoriTemplate } from "./tipos";

export async function listMyJobs(userId: string, limit: number = 30): Promise<YoriJob[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb
    .from("yori_jobs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[yori/queries] listMyJobs:", error.message);
    return [];
  }
  return (data ?? []) as YoriJob[];
}

export async function getJob(jobId: string): Promise<YoriJob | null> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb.from("yori_jobs").select("*").eq("id", jobId).maybeSingle();
  return (data as YoriJob | null) ?? null;
}

export async function listTemplates(orgId: string): Promise<YoriTemplate[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("yori_templates")
    .select("*")
    .or(`is_system.eq.true,organization_id.eq.${orgId}`)
    .order("is_system", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as YoriTemplate[];
}

export async function getTemplate(templateId: string): Promise<YoriTemplate | null> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb.from("yori_templates").select("*").eq("id", templateId).maybeSingle();
  return (data as YoriTemplate | null) ?? null;
}

export async function countJobsThisMonth(orgId: string): Promise<number> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const firstOfMonth = new Date();
  firstOfMonth.setUTCDate(1);
  firstOfMonth.setUTCHours(0, 0, 0, 0);
  const { count } = await sb
    .from("yori_jobs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .neq("status", "cancelled")
    .gte("created_at", firstOfMonth.toISOString());
  return count ?? 0;
}

export async function countUndownloadedJobs(userId: string): Promise<number> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { count } = await sb
    .from("yori_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "done")
    .is("downloaded_at", null);
  return count ?? 0;
}

export async function listJobsToProcess(limit: number = 5): Promise<YoriJob[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("yori_jobs")
    .select("*")
    .in("status", ["pending", "transcribing", "rendering"])
    .order("created_at", { ascending: true })
    .limit(limit);
  return (data ?? []) as YoriJob[];
}
