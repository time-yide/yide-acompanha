import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Status = Database["public"]["Enums"]["snapshot_status"];

export async function listSnapshotsForUser(userId: string, limit = 12) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("commission_snapshots")
    .select("*")
    .eq("user_id", userId)
    .order("mes_referencia", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getSnapshotById(id: string) {
  const supabase = await createClient();
  const { data: snap, error } = await supabase
    .from("commission_snapshots")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  const { data: items } = await supabase
    .from("commission_snapshot_items")
    .select("*")
    .eq("snapshot_id", id);
  return { snapshot: snap, items: items ?? [] };
}

export async function listSnapshotsForMonth(monthRef: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("commission_snapshots")
    .select("*, profile:profiles!commission_snapshots_user_id_fkey(id, nome, role, avatar_url)")
    .eq("mes_referencia", monthRef)
    .order("user_id");
  if (error) throw error;
  return data ?? [];
}

export async function getMonthsAwaitingApproval(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("commission_snapshots")
    .select("mes_referencia")
    .eq("status", "pending_approval" as Status);
  const set = new Set<string>();
  for (const r of (data ?? []) as Array<{ mes_referencia: string }>) {
    set.add(r.mes_referencia);
  }
  return [...set].sort();
}
