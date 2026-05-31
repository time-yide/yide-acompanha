import { unstable_cache } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Notification } from "./schema";

async function _listMyNotificationsImpl(userId: string, limit: number): Promise<Notification[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, user_id, tipo, titulo, mensagem, link, lida, created_at, prioridade")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Notification[];
}

export async function listMyNotifications(limit: number = 50): Promise<Notification[]> {
  const actor = await requireAuth();
  const cached = unstable_cache(
    async (paramsJson: string) => {
      const { uid, l } = JSON.parse(paramsJson) as { uid: string; l: number };
      return _listMyNotificationsImpl(uid, l);
    },
    ["notifications-list-v2"],
    { revalidate: 30, tags: ["notifications"] },
  );
  return cached(JSON.stringify({ uid: actor.id, l: limit }));
}

async function _countMyUnreadImpl(userId: string): Promise<number> {
  const supabase = createServiceRoleClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("lida", false);
  if (error) throw error;
  return count ?? 0;
}

export async function countMyUnread(): Promise<number> {
  // Chamado pelo NotificationBell (sininho da topbar) - toda página authed
  // renderiza esse counter. Cacheado 30s por user_id. Mutations em
  // notifications (criar, marcar como lida) revalidam tag "notifications".
  const actor = await requireAuth();
  const cached = unstable_cache(
    async (uid: string) => _countMyUnreadImpl(uid),
    ["notifications-count-unread"],
    { revalidate: 30, tags: ["notifications"] },
  );
  return cached(actor.id);
}
