import { createClient } from "@/lib/supabase/server";
import type { Notification } from "./schema";

export async function listMyNotifications(limit: number = 50): Promise<Notification[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, user_id, tipo, titulo, mensagem, link, lida, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Notification[];
}

export async function countMyUnread(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("lida", false);
  return count ?? 0;
}
