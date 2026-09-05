import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";
import {
  getOrgsWithPending,
  countSentToday,
  getPendingItems,
  updateDispatchItem,
} from "./queries";
import { DISPATCH_DAILY_LIMIT } from "./types";

function sb() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createServiceRoleClient() as any;
}

interface WorkerResult {
  processed: number;
  succeeded: number;
  failed: number;
  details: { id: string; status: string; error?: string }[];
}

async function findOrCreateConversation(
  orgId: string,
  telefone: string,
  twilioFrom: string,
  leadId: string,
): Promise<string> {
  const { data: existing } = await sb()
    .from("wpp_conversations")
    .select("id")
    .eq("organization_id", orgId)
    .eq("contato_telefone", telefone)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (existing) return (existing as any).id;

  const { data: lead } = await sb()
    .from("leads_gerados")
    .select("empresa")
    .eq("id", leadId)
    .maybeSingle();

  const { data: conv } = await sb()
    .from("wpp_conversations")
    .insert({
      organization_id: orgId,
      contato_nome: (lead as { empresa?: string })?.empresa ?? telefone,
      contato_telefone: telefone,
      canal: "whatsapp",
      lead_gerado_id: leadId,
      twilio_from: twilioFrom,
      nao_lidas: 0,
    })
    .select("id")
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (conv as any).id;
}

async function sendViaTwilio(
  to: string,
  from: string,
  body: string,
  statusCallbackUrl: string,
): Promise<{ sid: string } | { error: string }> {
  const env = getServerEnv();
  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return { error: "Twilio não configurado" };

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams({
    From: `whatsapp:${from}`,
    To: `whatsapp:${to}`,
    Body: body,
    StatusCallback: statusCallbackUrl,
  });

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!resp.ok) {
    const text = await resp.text();
    return { error: `${resp.status} ${text.slice(0, 200)}` };
  }

  const result = await resp.json();
  return { sid: (result as { sid?: string }).sid ?? "" };
}

export async function processDispatchQueue(): Promise<WorkerResult> {
  const env = getServerEnv();
  const statusUrl = `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/wpp/twilio/status`;
  const result: WorkerResult = { processed: 0, succeeded: 0, failed: 0, details: [] };

  const orgIds = await getOrgsWithPending();
  if (orgIds.length === 0) return result;

  for (const orgId of orgIds) {
    const sentToday = await countSentToday(orgId);
    const remaining = Math.max(0, DISPATCH_DAILY_LIMIT - sentToday);
    if (remaining === 0) continue;

    const items = await getPendingItems(orgId, remaining);

    for (const item of items) {
      result.processed++;
      await updateDispatchItem(item.id, { status: "enviando" });

      try {
        const convId = await findOrCreateConversation(
          orgId,
          item.telefone_destino,
          item.twilio_from,
          item.lead_gerado_id,
        );

        const sendResult = await sendViaTwilio(
          item.telefone_destino,
          item.twilio_from,
          item.mensagem_renderizada,
          statusUrl,
        );

        if ("error" in sendResult) {
          const tentativas = item.tentativas + 1;
          await updateDispatchItem(item.id, {
            status: tentativas >= 3 ? "falhou" : "pendente",
            erro_msg: sendResult.error,
            tentativas,
          });
          result.failed++;
          result.details.push({ id: item.id, status: "falhou", error: sendResult.error });
          continue;
        }

        await sb().from("wpp_messages").insert({
          conversation_id: convId,
          organization_id: orgId,
          autor: "sistema",
          texto: item.mensagem_renderizada,
          twilio_sid: sendResult.sid,
          status: "enviada",
          enviado_por: item.criado_por,
        });

        await sb()
          .from("wpp_conversations")
          .update({
            ultimo_texto: item.mensagem_renderizada.slice(0, 200),
            ultima_msg_em: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", convId);

        await updateDispatchItem(item.id, {
          status: "enviado",
          enviado_em: new Date().toISOString(),
          conversation_id: convId,
        });

        result.succeeded++;
        result.details.push({ id: item.id, status: "enviado" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await updateDispatchItem(item.id, {
          status: "falhou",
          erro_msg: msg,
          tentativas: item.tentativas + 1,
        });
        result.failed++;
        result.details.push({ id: item.id, status: "falhou", error: msg });
      }
    }
  }

  return result;
}
