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

export async function notificarAgente(
  colaboradorId: string,
  payload: NotifyPayload,
) {
  const channels = [
    `power-dialer:${colaboradorId}`,
    `power-dialer-bar:${colaboradorId}`,
  ];

  const broadcastResults = await Promise.all(
    channels.map((name) =>
      sb().channel(name).send({
        type: "broadcast",
        event: "lead-answered",
        payload,
      }),
    ),
  );

  for (let i = 0; i < broadcastResults.length; i++) {
    if (broadcastResults[i] !== "ok") {
      console.error(`[power-dialer] broadcast ${channels[i]} retornou:`, broadcastResults[i]);
    }
  }

  await sendWebPushToUser(colaboradorId, {
    title: `Lead atendeu: ${payload.leadEmpresa}`,
    body: [payload.leadCategoria, payload.leadCidade].filter(Boolean).join(" — "),
    url: "/",
    urgent: true,
  });
}
