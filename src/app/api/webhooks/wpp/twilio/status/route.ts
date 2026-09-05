import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { validarAssinaturaTwilio } from "@/lib/ligacoes/twilio";
import { getServerEnv } from "@/lib/env";

/**
 * Webhook de status de mensagens WhatsApp (StatusCallback) do Twilio.
 * Atualiza o status da mensagem no banco (enviada → entregue → lida / falhou).
 */
export async function POST(req: NextRequest) {
  const env = getServerEnv();
  const formData = await req.formData();
  const params: Record<string, string> = {};
  formData.forEach((v, k) => {
    params[k] = String(v);
  });

  const sig = req.headers.get("x-twilio-signature");
  const webhookUrl = `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/wpp/twilio/status`;
  if (!validarAssinaturaTwilio(sig, webhookUrl, params)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const messageSid = params.MessageSid ?? params.SmsSid ?? "";
  const messageStatus = (params.MessageStatus ?? "").toLowerCase();

  if (!messageSid) {
    return NextResponse.json({ ok: true });
  }

  const statusMap: Record<string, string> = {
    queued: "enviando",
    sent: "enviada",
    delivered: "entregue",
    read: "lida",
    failed: "falhou",
    undelivered: "falhou",
  };

  const novoStatus = statusMap[messageStatus];
  if (!novoStatus) {
    return NextResponse.json({ ok: true });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  await sb
    .from("wpp_messages")
    .update({ status: novoStatus })
    .eq("twilio_sid", messageSid);

  return NextResponse.json({ ok: true });
}
