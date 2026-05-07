// SERVER ONLY
import webPush from "web-push";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";

let configured = false;

function configureVapid() {
  if (configured) return true;
  const env = getServerEnv();
  const pub = env.VAPID_PUBLIC_KEY;
  const priv = env.VAPID_PRIVATE_KEY;
  const subject = env.VAPID_SUBJECT;
  if (!pub || !priv || !subject) {
    // Sem VAPID configurado: push fica desabilitado, mas sininho/email
    // continuam. Logamos uma vez pra debug.
    if (!configured) {
      console.warn("[push] VAPID keys ausentes — Web Push desabilitado");
      configured = true;
    }
    return false;
  }
  webPush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Envia push pra todas as subscriptions do user. Best-effort:
 * - Falha individual de subscription não interrompe as outras
 * - Subscription com 404/410 (gone) é deletada do banco
 * - Sem VAPID configurado: no-op silencioso
 */
export async function sendWebPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!configureVapid()) return;

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: subs } = await sb
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subs || subs.length === 0) return;

  const json = JSON.stringify(payload);

  await Promise.all(
    (subs as Array<{ id: string; endpoint: string; p256dh: string; auth: string }>).map(async (s) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          json,
        );
      } catch (e) {
        // 404/410 = subscription expirou (user desinstalou app, limpou
        // dados, etc). Remove pra parar de tentar enviar pra ela.
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await sb.from("push_subscriptions").delete().eq("id", s.id);
        } else {
          console.error("[push] sendNotification failed:", e);
        }
      }
    }),
  );
}
