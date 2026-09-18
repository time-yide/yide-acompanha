import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";
import { validarAssinaturaTwilio } from "@/lib/ligacoes/twilio";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return createServiceRoleClient() as any; }

/**
 * Webhook de gravação da Conference do Power Dialer. Chamado pelo Twilio
 * quando termina de processar a gravação (recordingStatusCallback com
 * evento "completed", configurado em twiml/[batchId]/lead).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const { batchId } = await params;
  const env = getServerEnv();
  const form = await req.formData();
  const p: Record<string, string> = {};
  form.forEach((v, k) => { p[k] = String(v); });

  const sig = req.headers.get("x-twilio-signature");
  const webhookUrl = `${env.NEXT_PUBLIC_APP_URL}/api/power-dialer/recording/${batchId}`;
  if (!validarAssinaturaTwilio(sig, webhookUrl, p)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const recordingSid = p.RecordingSid ?? "";

  if (recordingSid) {
    const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
    const gravacaoUrl = `${appUrl}/api/ligacoes/twilio/recording?sid=${recordingSid}`;
    await sb().from("power_dialer_batches").update({
      gravacao_url: gravacaoUrl,
      gravacao_sid: recordingSid,
    }).eq("id", batchId);
  }

  return new NextResponse("<Response/>", {
    headers: { "Content-Type": "text/xml" },
  });
}
