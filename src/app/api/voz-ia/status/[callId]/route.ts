import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getCallById, getLeadAIStatus, getActiveConfig } from "@/lib/voz-ia/queries";
import { sendWhatsAppFollowUp } from "@/lib/voz-ia/post-call";
import { getServerEnv } from "@/lib/env";
import { validarAssinaturaTwilio } from "@/lib/ligacoes/twilio";

function sb() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createServiceRoleClient() as any;
}

async function espelharNoDashboard(
  call: { organization_id: string; lead_gerado_id: string | null; twilio_call_sid: string | null },
  status: "atendida" | "perdida" | "caixa_postal",
  duracaoSegundos: number,
) {
  if (!call.lead_gerado_id) return;

  const { data: existing } = await sb()
    .from("ligacoes")
    .select("id")
    .eq("external_id", call.twilio_call_sid)
    .limit(1)
    .maybeSingle();
  if (existing) return;

  const { data: leadData } = await sb()
    .from("leads_gerados")
    .select("telefone, empresa")
    .eq("id", call.lead_gerado_id)
    .single();
  if (!leadData?.telefone) return;

  const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  let gravacaoUrl: string | null = null;
  if (call.twilio_call_sid) {
    gravacaoUrl = `${appUrl}/api/ligacoes/twilio/recording?call=${call.twilio_call_sid}`;
  }

  const now = new Date();
  try {
    await sb().from("ligacoes").insert({
      organization_id: call.organization_id,
      tipo: "telefone",
      numero: leadData.telefone,
      contato_nome: leadData.empresa ?? null,
      direcao: "saida",
      status,
      iniciada_em: new Date(now.getTime() - duracaoSegundos * 1000).toISOString(),
      finalizada_em: now.toISOString(),
      duracao_segundos: duracaoSegundos,
      gravacao_url: gravacaoUrl,
      origem: "voz_ia",
      external_id: call.twilio_call_sid,
      lead_gerado_id: call.lead_gerado_id,
      tags: ["ia"],
    });
  } catch (err) {
    console.error("[voz-ia status] erro ao espelhar ligação:", err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ callId: string }> },
) {
  const { callId } = await params;
  const form = await req.formData();
  const formParams = Object.fromEntries(form.entries()) as Record<string, string>;
  const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

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
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const callStatus = (formParams.CallStatus ?? "").toLowerCase();
  const callDuration = parseInt(formParams.CallDuration || "0", 10);

  const call = await getCallById(callId);
  if (!call) return NextResponse.json({ ok: false }, { status: 404 });

  if (callStatus === "in-progress") {
    await sb().from("ai_voice_calls").update({ status: "em_andamento" }).eq("id", callId);
  } else if (callStatus === "ringing") {
    await sb().from("ai_voice_calls").update({ status: "chamando" }).eq("id", callId);
  } else if (callStatus === "completed") {
    // Não sobrescreve se AMD já marcou como caixa_postal
    if (call.status !== "caixa_postal") {
      const jaFinalizado = call.finalizado_em != null;
      if (!jaFinalizado) {
        await sb().from("ai_voice_calls").update({
          status: "concluido",
          duracao_segundos: callDuration,
          finalizado_em: new Date().toISOString(),
        }).eq("id", callId);

        if (call.lead_gerado_id) {
          await sb().from("leads_gerados").update({ ai_status: null }).eq("id", call.lead_gerado_id);
        }
      }

      await espelharNoDashboard(call, callDuration > 5 ? "atendida" : "perdida", callDuration);
    } else {
      await espelharNoDashboard(call, "caixa_postal", callDuration);
    }
  } else if (callStatus === "no-answer" || callStatus === "busy") {
    await sb().from("ai_voice_calls").update({
      status: "nao_atendeu",
      finalizado_em: new Date().toISOString(),
      resultado_detalhe: callStatus === "busy" ? "Ocupado" : "Não atendeu",
    }).eq("id", callId);

    await espelharNoDashboard(call, "perdida", 0);

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
          await sb().from("leads_gerados").update({ ai_status: "esgotado" }).eq("id", call.lead_gerado_id);
        }
      } else {
        await sb().from("leads_gerados").update({ ai_status: null }).eq("id", call.lead_gerado_id);
      }

      const config2 = await getActiveConfig(call.organization_id);
      const leadAfter = await getLeadAIStatus(call.lead_gerado_id, call.organization_id);
      if (leadAfter && config2 && (leadAfter.ai_tentativas ?? 0) + 1 < config2.max_tentativas) {
        const nextAttempt = new Date();
        nextAttempt.setDate(nextAttempt.getDate() + Math.ceil(7 / config2.tentativas_por_semana));
        await sb().from("leads_gerados").update({
          ai_tentativas: (leadAfter.ai_tentativas ?? 0) + 1,
          ai_proxima_tentativa: nextAttempt.toISOString(),
        }).eq("id", call.lead_gerado_id);
      } else if (leadAfter && config2 && (leadAfter.ai_tentativas ?? 0) + 1 >= config2.max_tentativas) {
        await sb().from("leads_gerados").update({
          ai_tentativas: (leadAfter.ai_tentativas ?? 0) + 1,
          ai_status: "esgotado",
          ai_proxima_tentativa: null,
        }).eq("id", call.lead_gerado_id);
      }
    }
  } else if (callStatus === "failed") {
    const errMsg = formParams.ErrorMessage || "Twilio call failed";
    await sb().from("ai_voice_calls").update({
      status: "erro",
      erro_msg: errMsg,
      finalizado_em: new Date().toISOString(),
    }).eq("id", callId);

    await espelharNoDashboard(call, "perdida", 0);

    if (call.lead_gerado_id) {
      await sb().from("leads_gerados").update({ ai_status: null }).eq("id", call.lead_gerado_id);
    }
  }

  return NextResponse.json({ ok: true });
}
