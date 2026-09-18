import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWebPushToUser } from "@/lib/push/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return createServiceRoleClient() as any; }

interface NotifyPayload {
  type: "power_dialer_lead_answered";
  batchId: string;
  leadNome: string;
  leadEmpresa: string;
  leadCategoria: string | null;
  leadCidade: string | null;
}

/**
 * Notifica o colaborador (ex: Lucas) que um lead atendeu no power dialer.
 * `colaboradorId` é o mesmo profiles.id usado em todo o schema (convenção
 * colaborador_id -> profiles(id)), então reaproveita a infra de push
 * existente em src/lib/push/server.ts (tabela public.push_subscriptions).
 */
export async function notificarAgente(
  colaboradorId: string,
  payload: NotifyPayload,
) {
  // 1. Broadcast via Supabase Realtime (toast + som in-app)
  await sb()
    .channel(`power-dialer:${colaboradorId}`)
    .send({ type: "broadcast", event: "lead-answered", payload });

  // 2. Web Push (se offline ou em outra aba). No-op silencioso se VAPID não
  // estiver configurado ou o colaborador não tiver subscription.
  await sendWebPushToUser(colaboradorId, {
    title: `Lead atendeu: ${payload.leadEmpresa}`,
    body: [payload.leadCategoria, payload.leadCidade].filter(Boolean).join(" — "),
    url: "/",
    urgent: true,
  });
}
