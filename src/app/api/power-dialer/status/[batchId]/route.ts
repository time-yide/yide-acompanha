import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getBatchCallBySid, getBatchById } from "@/lib/power-dialer/queries";
import { processPowerDialerPostCall } from "@/lib/power-dialer/post-call";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return createServiceRoleClient() as any; }

/**
 * Webhook de status das chamadas de saída do Power Dialer (ringing,
 * answered, completed, no-answer, busy, failed). Chamado pelo Twilio a
 * partir do `statusCallback` configurado no dispatcher ao discar cada lead.
 *
 * Sempre responde TwiML vazio (não JSON) — mesma exigência do #547.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const { batchId } = await params;
  const form = await req.formData();
  const callSid = form.get("CallSid") as string;
  const callStatus = form.get("CallStatus") as string;
  const duration = form.get("CallDuration") as string | null;

  const batchCall = await getBatchCallBySid(callSid);
  if (!batchCall) return twimlOk();

  if (callStatus === "no-answer" || callStatus === "busy" || callStatus === "failed") {
    const statusMap: Record<string, string> = {
      "no-answer": "nao_atendeu",
      busy: "ocupado",
      failed: "erro",
    };
    await sb().from("power_dialer_batch_calls").update({
      status: statusMap[callStatus] ?? "erro",
      finalizado_em: new Date().toISOString(),
    }).eq("id", batchCall.id);

    // Limpa o ai_status do lead
    await sb().from("leads_gerados")
      .update({ ai_status: null })
      .eq("id", batchCall.lead_gerado_id);
  }

  if (callStatus === "completed" && batchCall.status === "atendeu") {
    await sb().from("power_dialer_batch_calls").update({
      finalizado_em: new Date().toISOString(),
    }).eq("id", batchCall.id);

    const batch = await getBatchById(batchId);
    if (batch) {
      const durationSec = duration ? parseInt(duration, 10) : 0;
      await sb().from("power_dialer_batches").update({
        status: "concluido",
        finalizado_em: new Date().toISOString(),
        duracao_segundos: durationSec,
      }).eq("id", batchId);

      await processPowerDialerPostCall(batchId, batch.organization_id, batchCall.lead_gerado_id, durationSec);
    }
  }

  return twimlOk();
}

function twimlOk() {
  return new NextResponse("<Response/>", {
    headers: { "Content-Type": "text/xml" },
  });
}
