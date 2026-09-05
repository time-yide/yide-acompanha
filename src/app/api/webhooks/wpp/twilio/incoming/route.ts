import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { validarAssinaturaTwilio } from "@/lib/ligacoes/twilio";
import { getServerEnv } from "@/lib/env";

/**
 * Webhook de mensagens WhatsApp recebidas (incoming) do Twilio.
 * Twilio envia POST com form-urlencoded quando uma msg chega.
 */
export async function POST(req: NextRequest) {
  const env = getServerEnv();
  const formData = await req.formData();
  const params: Record<string, string> = {};
  formData.forEach((v, k) => {
    params[k] = String(v);
  });

  // Validar assinatura Twilio
  const sig = req.headers.get("x-twilio-signature");
  const webhookUrl = `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/wpp/twilio/incoming`;
  if (!validarAssinaturaTwilio(sig, webhookUrl, params)) {
    console.warn("[wpp-webhook] Assinatura inválida");
    return new NextResponse("Forbidden", { status: 403 });
  }

  const from = params.From ?? "";
  const to = params.To ?? "";
  const body = params.Body ?? "";
  const messageSid = params.MessageSid ?? "";
  const numMedia = parseInt(params.NumMedia ?? "0", 10);

  // Strip whatsapp: prefix
  const telefoneContato = from.replace("whatsapp:", "");
  const twilioFrom = to.replace("whatsapp:", "");

  if (!telefoneContato) {
    return twimlResponse();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;

  // Encontrar ou criar conversa
  // Primeiro, encontrar a organização pelo número Twilio (twilio_from)
  // Se não existe conversa, precisamos de uma org — pega a primeira que tem esse número
  let { data: conv } = await sb
    .from("wpp_conversations")
    .select("id, organization_id")
    .eq("contato_telefone", telefoneContato)
    .eq("twilio_from", twilioFrom)
    .maybeSingle();

  if (!conv) {
    // Criar nova conversa — precisa de org_id
    // Busca org que já tem conversas com esse twilio_from, ou a primeira org
    const { data: existingConv } = await sb
      .from("wpp_conversations")
      .select("organization_id")
      .eq("twilio_from", twilioFrom)
      .limit(1)
      .maybeSingle();

    let orgId: string;
    if (existingConv) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      orgId = (existingConv as any).organization_id;
    } else {
      // Fallback: primeira organização
      const { data: firstOrg } = await sb
        .from("organizations")
        .select("id")
        .limit(1)
        .maybeSingle();
      if (!firstOrg) {
        console.error("[wpp-webhook] Nenhuma organização encontrada");
        return twimlResponse();
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      orgId = (firstOrg as any).id;
    }

    const { data: newConv, error: createErr } = await sb
      .from("wpp_conversations")
      .insert({
        organization_id: orgId,
        contato_nome: params.ProfileName ?? telefoneContato,
        contato_telefone: telefoneContato,
        canal: "whatsapp",
        twilio_from: twilioFrom,
        ultimo_texto: body.slice(0, 200),
        ultima_msg_em: new Date().toISOString(),
        nao_lidas: 1,
      })
      .select("id, organization_id")
      .single();

    if (createErr) {
      console.error("[wpp-webhook] Erro ao criar conversa:", createErr.message);
      return twimlResponse();
    }
    conv = newConv;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const convId = (conv as any).id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgId = (conv as any).organization_id;

  // Mídia (se houver)
  let mediaUrl: string | null = null;
  let mediaType: string | null = null;
  if (numMedia > 0) {
    mediaUrl = params.MediaUrl0 ?? null;
    mediaType = params.MediaContentType0 ?? null;
  }

  // Inserir mensagem
  await sb.from("wpp_messages").insert({
    conversation_id: convId,
    organization_id: orgId,
    autor: "lead",
    texto: body,
    media_url: mediaUrl,
    media_type: mediaType,
    twilio_sid: messageSid,
    status: "entregue",
  });

  // Atualizar conversa (último texto + incrementar nao_lidas)
  await sb.rpc("increment_nao_lidas", { conv_id: convId }).catch(() => {
    // Fallback se a function não existe
    sb.from("wpp_conversations")
      .update({
        ultimo_texto: body.slice(0, 200),
        ultima_msg_em: new Date().toISOString(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nao_lidas: ((conv as any).nao_lidas ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", convId)
      .then(() => {});
  });

  // Twilio espera TwiML de resposta (pode ser vazio)
  return twimlResponse();
}

function twimlResponse() {
  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    },
  );
}
