"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";

interface ActionOk {
  success: true;
  messageId: string;
}
interface ActionErr {
  error: string;
}
type ActionResult = ActionOk | ActionErr;

export async function sendWppMessageAction(
  conversationId: string,
  texto: string,
): Promise<ActionResult> {
  const user = await requireAuth();
  if (!texto.trim()) return { error: "Mensagem vazia" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;

  const { data: conv } = await sb
    .from("wpp_conversations")
    .select("id, contato_telefone, twilio_from, organization_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conv) return { error: "Conversa não encontrada" };

  const env = getServerEnv();
  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return { error: "Twilio não configurado. Configure TWILIO_ACCOUNT_SID e TWILIO_AUTH_TOKEN." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fromNumber = (conv as any).twilio_from;
  if (!fromNumber) {
    return { error: "Número de origem não configurado nessa conversa" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toNumber = `whatsapp:${(conv as any).contato_telefone}`;
  const fromWpp = `whatsapp:${fromNumber}`;

  // Inserir msg no banco primeiro (status: enviando)
  const { data: msg, error: insertErr } = await sb
    .from("wpp_messages")
    .insert({
      conversation_id: conversationId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      organization_id: (conv as any).organization_id,
      autor: "comercial",
      texto: texto.trim(),
      status: "enviando",
      enviado_por: user.id,
    })
    .select("id")
    .single();

  if (insertErr || !msg) {
    return { error: "Falha ao salvar mensagem" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messageId = (msg as any).id as string;

  // Enviar via Twilio
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const body = new URLSearchParams({
      From: fromWpp,
      To: toNumber,
      Body: texto.trim(),
      StatusCallback: `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/wpp/twilio/status`,
    });

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error("[wpp] Twilio send error:", errBody);
      await sb
        .from("wpp_messages")
        .update({ status: "falhou" })
        .eq("id", messageId);
      return { error: "Falha ao enviar pelo Twilio" };
    }

    const result = await resp.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const twilioSid = (result as any).sid ?? null;

    await sb
      .from("wpp_messages")
      .update({ status: "enviada", twilio_sid: twilioSid })
      .eq("id", messageId);

    // Atualizar conversa
    await sb
      .from("wpp_conversations")
      .update({
        ultimo_texto: texto.trim().slice(0, 200),
        ultima_msg_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId);
  } catch (err) {
    console.error("[wpp] send error:", err);
    await sb
      .from("wpp_messages")
      .update({ status: "falhou" })
      .eq("id", messageId);
    return { error: "Erro de rede ao enviar" };
  }

  revalidatePath("/conversas");
  return { success: true, messageId };
}

export async function markConversationReadAction(
  conversationId: string,
): Promise<void> {
  await requireAuth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  await sb
    .from("wpp_conversations")
    .update({ nao_lidas: 0, updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}
