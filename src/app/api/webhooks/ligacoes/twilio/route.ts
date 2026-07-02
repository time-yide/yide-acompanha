import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";
import {
  parseEventoWebhookTwilio,
  buildRecordingProxyUrl,
  validarAssinaturaTwilio,
  TWIML_VAZIO,
} from "@/lib/ligacoes/twilio";

// SEMPRE responder TwiML, nunca JSON. Este endpoint recebe dois callbacks no
// mesmo lugar: o `<Dial action>` (a Twilio USA o corpo como TwiML pra continuar
// a chamada) e o recordingStatusCallback (ignora o corpo). Responder JSON no
// caminho do action faz a Twilio anunciar "an application error has occurred".
// Status 200 sempre pelo mesmo motivo: não-2xx no action também vira erro falado.
function respostaTwiml() {
  return new NextResponse(TWIML_VAZIO, { headers: { "Content-Type": "text/xml" } });
}

// Webhook público autenticado por ?secret= + validação de X-Twilio-Signature.
// Recebe application/x-www-form-urlencoded da Twilio.
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret) {
    console.error("[webhook twilio] secret ausente");
    return respostaTwiml();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data: inst } = await sb
    .from("ligacoes_instancias")
    .select("id, organization_id, colaborador_id")
    .eq("webhook_secret", secret)
    .eq("provedor", "twilio")
    .is("arquivado_em", null)
    .maybeSingle();
  if (!inst) {
    console.error("[webhook twilio] secret inválido");
    return respostaTwiml();
  }

  let params: Record<string, string> = {};
  try {
    const form = await req.formData();
    params = Object.fromEntries(form.entries()) as Record<string, string>;
  } catch {
    return respostaTwiml();
  }

  const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL;
  // Assinatura contra a URL EXATA que a Twilio chamou. Atrás do proxy da Vercel
  // o host real pode não bater com NEXT_PUBLIC_APP_URL — por isso testamos também
  // a URL reconstruída dos headers (mesma correção do voice route, #544).
  const sig = req.headers.get("x-twilio-signature");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host");
  const candidateUrls = [
    host ? `${proto}://${host}${req.nextUrl.pathname}${req.nextUrl.search}` : null,
    `${appUrl.replace(/\/$/, "")}/api/webhooks/ligacoes/twilio?secret=${secret}`,
  ].filter((u): u is string => !!u);
  const sigOk = candidateUrls.some((u) => validarAssinaturaTwilio(sig, u, params));
  if (!sigOk) {
    console.error("[webhook twilio] assinatura inválida", { hasSig: !!sig, candidateUrls });
    return respostaTwiml();
  }

  const ev = parseEventoWebhookTwilio(params);
  if (!ev.externalId) return respostaTwiml();

  try {
    const { data: existing } = await sb
      .from("ligacoes")
      .select("id")
      .eq("origem", "twilio")
      .eq("external_id", ev.externalId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: Record<string, any> = {
      finalizada_em: new Date().toISOString(),
      raw_data: ev.raw,
    };
    if (ev.recordingSid) {
      patch.gravacao_url = buildRecordingProxyUrl(appUrl, ev.recordingSid, ev.externalId);
    }
    if (ev.duracaoSegundos > 0) patch.duracao_segundos = ev.duracaoSegundos;
    // Status só vem do callback de <Dial action> (tem DialCallStatus). O callback
    // de gravação não traz status de chamada — não deixar sobrescrever.
    if (params.DialCallStatus != null) patch.status = ev.statusInterno;

    if (existing) {
      await sb.from("ligacoes").update(patch).eq("id", (existing as { id: string }).id);
      return respostaTwiml();
    }

    // Upsert-on-missing: se a linha do voice route não existir (corrida/falha),
    // cria pra não perder o resultado (espelha o webhook da Zenvia).
    await sb.from("ligacoes").insert({
      organization_id: inst.organization_id,
      tipo: "telefone",
      direcao: "saida",
      colaborador_id: inst.colaborador_id,
      instancia_id: inst.id,
      numero: String(params.To ?? params.Called ?? "desconhecido"),
      status: params.DialCallStatus != null ? ev.statusInterno : "em_andamento",
      iniciada_em: new Date().toISOString(),
      finalizada_em: new Date().toISOString(),
      duracao_segundos: ev.duracaoSegundos,
      gravacao_url: ev.recordingSid ? buildRecordingProxyUrl(appUrl, ev.recordingSid, ev.externalId) : null,
      origem: "twilio",
      external_id: ev.externalId,
      raw_data: ev.raw,
    });
    return respostaTwiml();
  } catch (e) {
    console.error("[webhook twilio] erro:", (e as Error).message);
    return respostaTwiml();
  }
}
