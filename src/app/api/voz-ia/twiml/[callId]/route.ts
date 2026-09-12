import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { getCallById } from "@/lib/voz-ia/queries";
import { getServerEnv } from "@/lib/env";

const AVISO = "Esta ligação será gravada para fins de qualidade e treinamento.";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ callId: string }> },
) {
  const { callId } = await params;
  const call = await getCallById(callId);
  if (!call) {
    return new NextResponse("Not found", { status: 404 });
  }

  const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
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
