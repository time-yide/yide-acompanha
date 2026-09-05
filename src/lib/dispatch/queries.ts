import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { WppTemplate, WppDispatchItem, DispatchStats } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb(): any {
  return createServiceRoleClient() as any;
}

export async function listTemplates(
  orgId: string,
  base?: string | null,
): Promise<WppTemplate[]> {
  let q = sb()
    .from("wpp_templates")
    .select("*")
    .eq("organization_id", orgId)
    .eq("ativa", true)
    .order("created_at", { ascending: false });
  if (base) q = q.eq("base_prospeccao", base);
  const { data } = await q;
  return (data ?? []) as WppTemplate[];
}

export async function getTemplate(id: string): Promise<WppTemplate | null> {
  const { data } = await sb()
    .from("wpp_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as WppTemplate) ?? null;
}

export async function countSentToday(orgId: string): Promise<number> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count } = await sb()
    .from("wpp_dispatch_queue")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("status", "enviado")
    .gte("enviado_em", todayStart.toISOString());
  return count ?? 0;
}

export async function getPendingItems(
  orgId: string,
  limit: number,
): Promise<WppDispatchItem[]> {
  const { data } = await sb()
    .from("wpp_dispatch_queue")
    .select("*")
    .eq("organization_id", orgId)
    .eq("status", "pendente")
    .lte("agendado_para", new Date().toISOString())
    .order("agendado_para", { ascending: true })
    .limit(limit);
  return (data ?? []) as WppDispatchItem[];
}

export async function getDispatchStats(orgId: string): Promise<DispatchStats> {
  const [total, pendentes, enviados, falhou, enviadosHoje] = await Promise.all([
    sb()
      .from("wpp_dispatch_queue")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .then((r: { count: number | null }) => r.count ?? 0),
    sb()
      .from("wpp_dispatch_queue")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "pendente")
      .then((r: { count: number | null }) => r.count ?? 0),
    sb()
      .from("wpp_dispatch_queue")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "enviado")
      .then((r: { count: number | null }) => r.count ?? 0),
    sb()
      .from("wpp_dispatch_queue")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "falhou")
      .then((r: { count: number | null }) => r.count ?? 0),
    countSentToday(orgId),
  ]);
  return { total, pendentes, enviados, falhou, enviadosHoje };
}

export async function getOrgsWithPending(): Promise<string[]> {
  const { data } = await sb()
    .from("wpp_dispatch_queue")
    .select("organization_id")
    .eq("status", "pendente")
    .lte("agendado_para", new Date().toISOString())
    .limit(100);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ids: string[] = (data ?? []).map((r: any) => String(r.organization_id));
  return [...new Set(ids)];
}

export async function updateDispatchItem(
  id: string,
  fields: Partial<WppDispatchItem>,
): Promise<void> {
  await sb()
    .from("wpp_dispatch_queue")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);
}
