import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";
import { buildTwilioWebhookUrl, validarAssinaturaTwilio } from "@/lib/ligacoes/twilio";

const AVISO_GRAVACAO =
  "Esta ligação será gravada para fins de qualidade e treinamento.";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const params = Object.fromEntries(form.entries()) as Record<string, string>;
  const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL;
  const sigOk = validarAssinaturaTwilio(
    req.headers.get("x-twilio-signature"),
    `${appUrl.replace(/\/$/, "")}/api/ligacoes/twilio/voice`,
    params,
  );
  if (!sigOk) {
    return new NextResponse("forbidden", { status: 403 });
  }
  const to = String(form.get("To") ?? "");
  const instanciaId = String(form.get("instancia_id") ?? "");
  const callSid = String(form.get("CallSid") ?? "");
  const contatoNome = form.get("contato_nome") ? String(form.get("contato_nome")) : null;
  const leadId = form.get("lead_id") ? String(form.get("lead_id")) : null;
  const leadGeradoId = form.get("lead_gerado_id") ? String(form.get("lead_gerado_id")) : null;
  const clientId = form.get("client_id") ? String(form.get("client_id")) : null;

  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data: inst } = await sb
    .from("ligacoes_instancias")
    .select("id, organization_id, colaborador_id, numero, webhook_secret, provedor")
    .eq("id", instanciaId)
    .eq("provedor", "twilio")
    .is("arquivado_em", null)
    .maybeSingle();

  if (!inst || !to) {
    twiml.say({ language: "pt-BR" }, "Configuração de ligação inválida.");
    return new NextResponse(twiml.toString(), { headers: { "Content-Type": "text/xml" } });
  }

  // Cria a linha já em andamento; webhook casa por external_id = CallSid.
  try {
    await sb.from("ligacoes").insert({
      organization_id: inst.organization_id,
      tipo: "telefone",
      direcao: "saida",
      colaborador_id: inst.colaborador_id,
      instancia_id: inst.id,
      numero: to,
      contato_nome: contatoNome,
      lead_id: leadId,
      lead_gerado_id: leadGeradoId,
      client_id: clientId,
      status: "em_andamento",
      iniciada_em: new Date().toISOString(),
      origem: "twilio",
      external_id: callSid || null,
    });
  } catch (e) {
    console.error("[twilio voice] insert falhou:", (e as Error).message);
  }

  const webhookUrl = buildTwilioWebhookUrl(appUrl, inst.webhook_secret as string);

  // Aviso legal de gravação antes de conectar.
  twiml.say({ language: "pt-BR" }, AVISO_GRAVACAO);

  const dial = twiml.dial({
    callerId: (inst.numero as string) || undefined,
    record: "record-from-answer",
    recordingStatusCallback: webhookUrl,
    recordingStatusCallbackEvent: ["completed"],
    action: webhookUrl,
    answerOnBridge: true,
  });
  dial.number(to);

  return new NextResponse(twiml.toString(), { headers: { "Content-Type": "text/xml" } });
}
