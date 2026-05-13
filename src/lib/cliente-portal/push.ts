// SERVER ONLY: do not import from client components

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWebPushToUser } from "@/lib/push/server";

export interface ClientPushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Envia push pra TODOS os portal users ativos de um cliente.
 *
 * Cliente pode ter até 5 portal users (ex.: sócios). Todos recebem o
 * push — cada um decide se desliga no próprio device. Best-effort:
 * falha em um device não impede os outros.
 *
 * Use de código server (server actions, cron, route handlers) — nunca
 * de input direto do user (não autorizamos cliente disparar push pra
 * outro cliente).
 */
export async function sendPushToClient(
  clientId: string,
  payload: ClientPushPayload,
): Promise<void> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("client_portal_users")
    .select("user_id")
    .eq("client_id", clientId)
    .eq("ativo", true);

  const rows = (data ?? []) as Array<{ user_id: string }>;
  if (rows.length === 0) return;

  await Promise.allSettled(
    rows.map((r) => sendWebPushToUser(r.user_id, payload)),
  );
}
