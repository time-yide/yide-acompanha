import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { getServerEnv } from "@/lib/env";
import { validarAssinaturaTwilio } from "@/lib/ligacoes/twilio";
import { getBatchById, getPowerDialerConfig } from "@/lib/power-dialer/queries";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const { batchId } = await params;
  const env = getServerEnv();
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  const form = await req.formData();
  const p: Record<string, string> = {};
  form.forEach((v, k) => { p[k] = String(v); });
  const sig = req.headers.get("x-twilio-signature");
  const webhookUrl = `${appUrl}/api/power-dialer/twiml/${batchId}/lead`;
  if (!validarAssinaturaTwilio(sig, webhookUrl, p)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const batch = await getBatchById(batchId);
  if (!batch) return new NextResponse("Not found", { status: 404 });

  const config = await getPowerDialerConfig(batch.organization_id);
  const greeting = config?.power_dialer_greeting ?? "Olá, tudo bem? Só um momento...";

  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  twiml.say({ language: "pt-BR", voice: "Polly.Vitoria-Neural" }, greeting);

  const dial = twiml.dial();
  dial.conference(
    {
      startConferenceOnEnter: true,
      endConferenceOnExit: false,
      record: "record-from-start",
      recordingStatusCallback: `${appUrl}/api/power-dialer/recording/${batchId}`,
      recordingStatusCallbackEvent: ["completed"],
      statusCallback: `${appUrl}/api/power-dialer/conference-event/${batchId}`,
      statusCallbackEvent: ["join", "leave", "end"],
      waitUrl: "",
    },
    batch.conference_name,
  );

  return new NextResponse(twiml.toString(), {
    headers: { "Content-Type": "text/xml" },
  });
}
