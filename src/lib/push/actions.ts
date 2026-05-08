"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";

type ActionResult = { error?: string; success?: boolean };

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  user_agent: z.string().optional().nullable(),
});

/**
 * Salva a Push Subscription criada pelo browser. Idempotente: se o user
 * já tem subscription com mesmo endpoint, atualiza chaves (caso renovem).
 */
export async function subscribePushAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  const parsed = subscribeSchema.safeParse({
    endpoint: formData.get("endpoint"),
    p256dh: formData.get("p256dh"),
    auth: formData.get("auth"),
    user_agent: formData.get("user_agent") ?? null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb.from("push_subscriptions").upsert(
    {
      user_id: actor.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.p256dh,
      auth: parsed.data.auth,
      user_agent: parsed.data.user_agent || null,
    },
    { onConflict: "user_id,endpoint" },
  );
  if (error) return { error: error.message };
  return { success: true };
}

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

/**
 * Remove a subscription pra esse endpoint. Browser também desativa local
 * via PushSubscription.unsubscribe() — esse action limpa o lado do server.
 */
export async function unsubscribePushAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  const parsed = unsubscribeSchema.safeParse({
    endpoint: formData.get("endpoint"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("push_subscriptions")
    .delete()
    .eq("user_id", actor.id)
    .eq("endpoint", parsed.data.endpoint);
  if (error) return { error: error.message };
  return { success: true };
}
