import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { getCallById } from "@/lib/voz-ia/queries";
import { getServerEnv } from "@/lib/env";
import { validarAssinaturaTwilio } from "@/lib/ligacoes/twilio";

const AVISO = "Esta ligação será gravada para fins de qualidade e treinamento.";

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
    `${appUrl}/api/voz-ia/twiml/${callId}`,
  ].filter((u): u is string => !!u);
  const sigOk = candidateUrls.some((u) => validarAssinaturaTwilio(sig, u, formParams));
  if (!sigOk) {
    console.error("[voz-ia twiml] assinatura inválida", { hasSig: !!sig, candidateUrls });
    return new NextResponse("forbidden", { status: 403 });
  }

  const call = await getCallById(callId);
  if (!call) {
    return new NextResponse("Not found", { status: 404 });
  }

  const wsUrl = appUrl.replace(/^http/, "ws");

  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();
  twiml.say({ language: "pt-BR" }, AVISO);

  const connect = twiml.connect();
  connect.stream({ url: `${wsUrl}/api/voz-ia/media-stream/${callId}` });

  return new NextResponse(twiml.toString(), {
    headers: { "Content-Type": "text/xml" },
  });
}
