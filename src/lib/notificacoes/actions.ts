"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { listMyNotifications, countMyUnread } from "./queries";
import { markReadSchema } from "./schema";

export async function markNotificationReadAction(formData: FormData) {
  await requireAuth();
  const parsed = markReadSchema.safeParse({ id: String(formData.get("id") ?? "") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ lida: true })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath("/notificacoes");
  return { success: true };
}

export async function markAllNotificationsReadAction() {
  const actor = await requireAuth();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ lida: true })
    .eq("user_id", actor.id)
    .eq("lida", false);
  if (error) return { error: error.message };

  revalidatePath("/notificacoes");
  return { success: true };
}

export async function getMyNotificationsAction() {
  await requireAuth();
  const [items, unread] = await Promise.all([listMyNotifications(10), countMyUnread()]);
  return { items, unread };
}
