import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Notification } from "./schema";

export async function listMyNotifications(limit: number = 50): Promise<Notification[]> {
  const actor = await requireAuth();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, user_id, tipo, titulo, mensagem, link, lida, created_at")
    .eq("user_id", actor.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Notification[];
}

export async function countMyUnread(): Promise<number> {
  const actor = await requireAuth();
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", actor.id)
    .eq("lida", false);
  if (error) throw error;
  return count ?? 0;
}
