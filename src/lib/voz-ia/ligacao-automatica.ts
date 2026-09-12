import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";
import { getActiveConfig, getLeadAIStatus } from "./queries";

interface LigacaoOk { success: true; callId: string }
interface LigacaoErr { error: string }
export type LigacaoAutomaticaResult = LigacaoOk | LigacaoErr;

export async function contarLigacoesHoje(orgId: string): Promise<number> {
  const sb = createServiceRoleClient() as any;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const { count } = await sb
    .from("ai_voice_calls")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .gte("criado_em", hoje.toISOString());
  return count ?? 0;
}

export async function dispararLigacaoIA(
  orgId: string,
  leadGeradoId: string,
): Promise<LigacaoAutomaticaResult> {
  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) return { error: "OPENAI_API_KEY não configurada" };
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN)
    return { error: "Twilio não configurado" };

  const sb = createServiceRoleClient() as any;

  const config = await getActiveConfig(orgId);
  if (!config) return { error: "Sem config de voz ativa" };

  const lead = await getLeadAIStatus(leadGeradoId, orgId);
  if (!lead) return { error: "Lead não encontrado" };
  if (!lead.telefone && !lead.whatsapp) return { error: "Lead sem telefone" };
  if (lead.ai_status === "em_ligacao") return { error: "Ligação já ativa" };

  const telefone = lead.telefone || lead.whatsapp!;

  const { data: instancia } = await sb
    .from("ligacoes_instancias")
    .select("numero_saida, id")
    .eq("organization_id", orgId)
    .eq("provedor", "twilio")
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  if (!instancia?.numero_saida) return { error: "Sem instância Twilio" };

  const { data: call, error: insertErr } = await sb
    .from("ai_voice_calls")
    .insert({
      organization_id: orgId,
      lead_gerado_id: leadGeradoId,
      config_id: config.id,
      prompt_usado: config.system_prompt,
      voz: config.voz,
      twilio_from: instancia.numero_saida,
      status: "iniciando",
      iniciado_por: null,
      resultado_detalhe: "Ligação automática — motor de prospecção",
    })
    .select("id")
    .single();
  if (insertErr || !call) return { error: insertErr?.message ?? "Erro ao criar chamada" };

  await sb
    .from("leads_gerados")
    .update({ ai_status: "em_ligacao" })
    .eq("id", leadGeradoId);

  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Calls.json`;
  const body = new URLSearchParams({
    To: telefone,
    From: instancia.numero_saida,
    Url: `${appUrl}/api/voz-ia/twiml/${call.id}`,
    StatusCallback: `${appUrl}/api/voz-ia/status/${call.id}`,
    StatusCallbackEvent: "initiated ringing answered completed",
    Record: "true",
  });

  const twilioResp = await fetch(twilioUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!twilioResp.ok) {
    const errBody = await twilioResp.text();
    await sb.from("ai_voice_calls").update({
      status: "erro",
      erro_msg: errBody,
      finalizado_em: new Date().toISOString(),
    }).eq("id", call.id);
    await sb.from("leads_gerados").update({ ai_status: null }).eq("id", leadGeradoId);
    return { error: `Twilio erro: ${twilioResp.status}` };
  }

  const twilioData = await twilioResp.json();
  await sb.from("ai_voice_calls").update({
    twilio_call_sid: twilioData.sid,
    status: "chamando",
  }).eq("id", call.id);

  return { success: true, callId: call.id };
}
