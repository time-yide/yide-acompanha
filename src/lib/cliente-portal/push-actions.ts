"use server";

import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireClientPortalAuth } from "@/lib/auth/client-portal-session";
import { getServerEnv } from "@/lib/env";
import { sendWebPushToUser } from "@/lib/push/server";

type ActionResult = { error?: string; success?: boolean };

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  user_agent: z.string().optional().nullable(),
});

/**
 * Salva a Push Subscription criada pelo browser pra um cliente final.
 * Usa requireClientPortalAuth (sessão do portal externo) - NUNCA a
 * sessão de colaborador interno.
 *
 * Idempotente: re-subscribe do mesmo endpoint atualiza chaves.
 */
export async function subscribeClientPortalPushAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireClientPortalAuth();
  const parsed = subscribeSchema.safeParse({
    endpoint: formData.get("endpoint"),
    p256dh: formData.get("p256dh"),
    auth: formData.get("auth"),
    user_agent: formData.get("user_agent") ?? null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const { error } = await sb.from("push_subscriptions").upsert(
    {
      user_id: user.userId,
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
 * Remove a subscription pra esse endpoint do portal user logado.
 */
export async function unsubscribeClientPortalPushAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireClientPortalAuth();
  const parsed = unsubscribeSchema.safeParse({
    endpoint: formData.get("endpoint"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const { error } = await sb
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.userId)
    .eq("endpoint", parsed.data.endpoint);
  if (error) return { error: error.message };
  return { success: true };
}

/**
 * Dispara push de teste pro portal user logado - pra validar
 * end-to-end no celular instalado.
 */
export async function sendTestClientPortalPushAction(): Promise<ActionResult> {
  const user = await requireClientPortalAuth();
  const env = getServerEnv();
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    return { error: "VAPID não configurado no servidor." };
  }

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const { count } = await sb
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.userId);
  if (!count || count === 0) {
    return { error: "Nenhum dispositivo inscrito. Ative as notificações primeiro." };
  }

  await sendWebPushToUser(user.userId, {
    title: "Yide · Teste",
    body: "Push está funcionando neste dispositivo ✓",
    url: "/cliente",
    tag: "test",
  });
  return { success: true };
}
