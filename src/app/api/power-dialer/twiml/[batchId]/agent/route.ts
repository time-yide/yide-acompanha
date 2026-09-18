import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { getServerEnv } from "@/lib/env";
import { validarAssinaturaTwilio } from "@/lib/ligacoes/twilio";
import { getBatchById } from "@/lib/power-dialer/queries";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const { batchId } = await params;
  const env = getServerEnv();

  const form = await req.formData();
  const p: Record<string, string> = {};
  form.forEach((v, k) => { p[k] = String(v); });
  const sig = req.headers.get("x-twilio-signature");
  const webhookUrl = `${env.NEXT_PUBLIC_APP_URL}/api/power-dialer/twiml/${batchId}/agent`;
  if (!validarAssinaturaTwilio(sig, webhookUrl, p)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const batch = await getBatchById(batchId);
  if (!batch) return new NextResponse("Not found", { status: 404 });

  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  const dial = twiml.dial();
  dial.conference(
    {
      startConferenceOnEnter: true,
      endConferenceOnExit: true,
      beep: "false",
    },
    batch.conference_name,
  );

  return new NextResponse(twiml.toString(), {
    headers: { "Content-Type": "text/xml" },
  });
}
