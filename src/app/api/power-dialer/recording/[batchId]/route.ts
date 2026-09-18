import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";

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
  const form = await req.formData();
  const recordingSid = form.get("RecordingSid") as string;

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
