import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getCallById, getLeadAIStatus, getActiveConfig } from "@/lib/voz-ia/queries";
import { sendWhatsAppFollowUp } from "@/lib/voz-ia/post-call";
import { getServerEnv } from "@/lib/env";
import { validarAssinaturaTwilio } from "@/lib/ligacoes/twilio";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ callId: string }> },
) {
  const { callId } = await params;
  const form = await req.formData();
  const formParams = Object.fromEntries(form.entries()) as Record<string, string>;
  const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  // Twilio signature validation (same pattern as TwiML route)
  const sig = req.headers.get("x-twilio-signature");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host");
  const candidateUrls = [
    host ? `${proto}://${host}${req.nextUrl.pathname}` : null,
    `${appUrl}/api/voz-ia/status/${callId}`,
  ].filter((u): u is string => !!u);
  const sigOk = candidateUrls.some((u) => validarAssinaturaTwilio(sig, u, formParams));
  if (!sigOk) {
    console.error("[voz-ia status] assinatura inválida", { hasSig: !!sig, candidateUrls });
    return new NextResponse("forbidden", { status: 403 });
  }

  const callStatus = (formParams.CallStatus ?? "").toLowerCase();

  const call = await getCallById(callId);
  if (!call) return NextResponse.json({ ok: false }, { status: 404 });

  const sb = createServiceRoleClient() as any;

  if (callStatus === "no-answer" || callStatus === "busy") {
    await sb.from("ai_voice_calls").update({
      status: "nao_atendeu",
      finalizado_em: new Date().toISOString(),
      resultado_detalhe: callStatus === "busy" ? "Ocupado" : "Não atendeu",
    }).eq("id", callId);

    // Pula follow-up e cadência pra ligações de teste (sem lead)
    if (call.lead_gerado_id) {
      const config = await getActiveConfig(call.organization_id);
      if (config?.wpp_followup_ativo) {
        const lead = await getLeadAIStatus(call.lead_gerado_id, call.organization_id);
        const telefone = lead?.whatsapp || lead?.telefone;
        if (telefone) {
          await sendWhatsAppFollowUp({
            callId,
            orgId: call.organization_id,
            leadGeradoId: call.lead_gerado_id,
            telefone,
            empresa: lead.empresa ?? "sua empresa",
            twilioFrom: call.twilio_from,
            template: config.wpp_followup_template,
          });
        } else {
          await sb.from("leads_gerados").update({ ai_status: "esgotado" }).eq("id", call.lead_gerado_id);
        }
      } else {
        await sb.from("leads_gerados").update({ ai_status: null }).eq("id", call.lead_gerado_id);
      }

      // Schedule next attempt
      const config2 = await getActiveConfig(call.organization_id);
      const leadAfter = await getLeadAIStatus(call.lead_gerado_id, call.organization_id);
      if (leadAfter && config2 && (leadAfter.ai_tentativas ?? 0) + 1 < config2.max_tentativas) {
        const nextAttempt = new Date();
        nextAttempt.setDate(nextAttempt.getDate() + Math.ceil(7 / config2.tentativas_por_semana));
        await sb.from("leads_gerados").update({
          ai_tentativas: (leadAfter.ai_tentativas ?? 0) + 1,
          ai_proxima_tentativa: nextAttempt.toISOString(),
        }).eq("id", call.lead_gerado_id);
      } else if (leadAfter && config2 && (leadAfter.ai_tentativas ?? 0) + 1 >= config2.max_tentativas) {
        await sb.from("leads_gerados").update({
          ai_tentativas: (leadAfter.ai_tentativas ?? 0) + 1,
          ai_status: "esgotado",
          ai_proxima_tentativa: null,
        }).eq("id", call.lead_gerado_id);
      }
    }
  } else if (callStatus === "failed") {
    const errMsg = formParams.ErrorMessage || "Twilio call failed";
    await sb.from("ai_voice_calls").update({
      status: "erro",
      erro_msg: errMsg,
      finalizado_em: new Date().toISOString(),
    }).eq("id", callId);
    if (call.lead_gerado_id) {
      await sb.from("leads_gerados").update({ ai_status: null }).eq("id", call.lead_gerado_id);
    }
  }

  return NextResponse.json({ ok: true });
}
