import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getCallById } from "@/lib/voz-ia/queries";
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

  const sig = req.headers.get("x-twilio-signature");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host");
  const candidateUrls = [
    host ? `${proto}://${host}${req.nextUrl.pathname}` : null,
    `${appUrl}/api/voz-ia/amd/${callId}`,
  ].filter((u): u is string => !!u);
  const sigOk = candidateUrls.some((u) => validarAssinaturaTwilio(sig, u, formParams));
  if (!sigOk) {
    console.error("[voz-ia amd] assinatura inválida", { hasSig: !!sig, candidateUrls });
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const answeredBy = (formParams.AnsweredBy ?? "").toLowerCase();
  console.log("[voz-ia amd]", callId, "AnsweredBy:", answeredBy);

  if (answeredBy === "human") {
    return NextResponse.json({ ok: true, action: "none" });
  }

  // Caixa postal / máquina / fax → desligar imediatamente
  const call = await getCallById(callId);
  if (!call?.twilio_call_sid) {
    return NextResponse.json({ ok: true, action: "call_not_found" });
  }

  const env = getServerEnv();
  const hangupUrl = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Calls/${call.twilio_call_sid}.json`;
  await fetch(hangupUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ Status: "completed" }).toString(),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  await sb.from("ai_voice_calls").update({
    status: "caixa_postal",
    resultado_detalhe: `Caixa postal detectada (${answeredBy})`,
    finalizado_em: new Date().toISOString(),
  }).eq("id", callId);

  if (call.lead_gerado_id) {
    await sb.from("leads_gerados").update({ ai_status: null }).eq("id", call.lead_gerado_id);
  }

  // Corrige ligação que o status callback já criou como "perdida" antes do AMD.
  if (call.twilio_call_sid) {
    await sb.from("ligacoes")
      .update({ status: "caixa_postal" })
      .eq("external_id", call.twilio_call_sid)
      .eq("status", "perdida");
  }

  console.log("[voz-ia amd] desligou caixa postal:", callId, call.twilio_call_sid);
  return NextResponse.json({ ok: true, action: "hangup" });
}
