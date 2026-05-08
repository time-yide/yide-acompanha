"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { sendWebPushToUser } from "./server";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";

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

/**
 * Dispara um web push de teste pro próprio usuário. Usado pra validar
 * end-to-end no iPhone instalado: ative push → toque "Enviar teste" →
 * a notificação chega no SO. Falha silenciosa de cada subscription
 * é tratada em sendWebPushToUser; aqui retornamos erro só quando a
 * pré-condição falha (sem VAPID, sem subscription).
 */
export async function sendTestPushAction(): Promise<ActionResult> {
  const actor = await requireAuth();
  const env = getServerEnv();
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    return { error: "VAPID não configurado no servidor." };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { count } = await sb
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", actor.id);
  if (!count || count === 0) {
    return { error: "Nenhum dispositivo inscrito. Ative as notificações primeiro." };
  }

  await sendWebPushToUser(actor.id, {
    title: "Yide — Teste",
    body: "Push está funcionando neste dispositivo ✓",
    url: "/configuracoes",
    tag: "test",
  });
  return { success: true };
}

/**
 * Simula o digest 18h pro próprio usuário com dados fake (sem criar
 * eventos no banco). Usa o evento_tipo real `evento_calendario_amanha`
 * pra validar o formato de texto que o cron real vai enviar.
 */
export async function sendTestEventTomorrowAction(): Promise<ActionResult> {
  const actor = await requireAuth();
  const env = getServerEnv();
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    return { error: "VAPID não configurado no servidor." };
  }

  await dispatchNotification({
    evento_tipo: "evento_calendario_amanha",
    titulo: "Você tem 2 eventos amanhã",
    mensagem: "10h — Reunião de teste · 14h — Gravação de teste",
    link: "/calendario",
    user_ids_extras: [actor.id],
  });
  return { success: true };
}

/**
 * Simula o lembrete "30 min antes" pro próprio usuário. Usa o
 * evento_tipo real `evento_calendario_30min` mas não toca em
 * calendar_events (sem evento real, sem reminded_30min_at).
 */
export async function sendTestEvent30MinAction(): Promise<ActionResult> {
  const actor = await requireAuth();
  const env = getServerEnv();
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    return { error: "VAPID não configurado no servidor." };
  }

  await dispatchNotification({
    evento_tipo: "evento_calendario_30min",
    titulo: "Em 30 min: Reunião de teste",
    mensagem: "Começa às 14:30",
    link: "/calendario",
    user_ids_extras: [actor.id],
  });
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
