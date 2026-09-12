import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";
import type { TranscriptionItem } from "./types";

interface PostCallData {
  callId: string;
  orgId: string;
  leadGeradoId: string;
  transcription: TranscriptionItem[];
  durationSeconds: number;
  twilioCallSid: string | null;
}

export async function processPostCall(data: PostCallData) {
  const sb = createServiceRoleClient() as any;
  const env = getServerEnv();
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  let gravacaoUrl: string | null = null;
  if (data.twilioCallSid) {
    gravacaoUrl = `${appUrl}/api/ligacoes/twilio/recording?call=${data.twilioCallSid}`;
  }

  const updatePayload: Record<string, unknown> = {
    transcricao: data.transcription,
    duracao_segundos: data.durationSeconds,
    finalizado_em: new Date().toISOString(),
  };
  if (gravacaoUrl) updatePayload.gravacao_url = gravacaoUrl;

  await sb.from("ai_voice_calls").update(updatePayload).eq("id", data.callId);

  // Incrementa tentativas no lead (read + write)
  const { data: lead } = await sb
    .from("leads_gerados")
    .select("ai_tentativas")
    .eq("id", data.leadGeradoId)
    .single();
  if (lead) {
    await sb
      .from("leads_gerados")
      .update({ ai_tentativas: (lead.ai_tentativas ?? 0) + 1 })
      .eq("id", data.leadGeradoId);
  }

  // Registra como lead_attempt (integração com 14 batidas)
  await sb.from("lead_attempts").insert({
    organization_id: data.orgId,
    lead_gerado_id: data.leadGeradoId,
    tipo: "ligacao",
    canal: "telefone",
    notas: "Ligação IA automática",
  }).catch(() => {});
}

export async function sendWhatsAppFollowUp(data: {
  callId: string;
  orgId: string;
  leadGeradoId: string;
  telefone: string;
  empresa: string;
  twilioFrom: string;
  template: string | null;
}) {
  const env = getServerEnv();
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return;

  const sb = createServiceRoleClient() as any;

  const mensagem = (data.template ?? "Oi! Tentei ligar pra você agora da Yide Digital. Somos uma agência de marketing e queria conversar sobre como podemos ajudar a {empresa} a crescer nas redes sociais. Posso te explicar por aqui?")
    .replace("{empresa}", data.empresa);

  const whatsappTo = data.telefone.replace(/[^\d+]/g, "");
  const toNumber = `whatsapp:+${whatsappTo.replace(/^\+/, "")}`;
  const fromNumber = `whatsapp:${data.twilioFrom}`;

  // Find or create conversation
  const { data: conv } = await sb
    .from("wpp_conversations")
    .select("id")
    .eq("organization_id", data.orgId)
    .eq("contato_telefone", whatsappTo)
    .maybeSingle();

  let conversationId: string;
  if (conv) {
    conversationId = conv.id;
  } else {
    const { data: newConv } = await sb
      .from("wpp_conversations")
      .insert({
        organization_id: data.orgId,
        contato_nome: data.empresa,
        contato_telefone: whatsappTo,
        canal: "whatsapp",
        lead_gerado_id: data.leadGeradoId,
        twilio_from: data.twilioFrom,
      })
      .select("id")
      .single();
    if (!newConv) return;
    conversationId = newConv.id;
  }

  // Insert message record
  const { data: msg } = await sb
    .from("wpp_messages")
    .insert({
      conversation_id: conversationId,
      organization_id: data.orgId,
      autor: "sistema",
      texto: mensagem,
      status: "enviando",
    })
    .select("id")
    .single();

  // Send via Twilio REST API
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const body = new URLSearchParams({
    From: fromNumber,
    To: toNumber,
    Body: mensagem,
    StatusCallback: `${appUrl}/api/webhooks/wpp/twilio/status`,
  });

  const resp = await fetch(twilioUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (resp.ok && msg) {
    const twilioData = await resp.json();
    await sb.from("wpp_messages").update({ twilio_sid: twilioData.sid, status: "enviada" }).eq("id", msg.id);
  }

  // Update call record + lead
  await sb.from("ai_voice_calls").update({
    followup_wpp_enviado: true,
    conversation_id: conversationId,
  }).eq("id", data.callId);

  await sb.from("leads_gerados").update({
    ai_status: "followup_wpp",
  }).eq("id", data.leadGeradoId);

  await sb.from("wpp_conversations").update({
    ultimo_texto: mensagem,
    ultima_msg_em: new Date().toISOString(),
  }).eq("id", conversationId);
}
