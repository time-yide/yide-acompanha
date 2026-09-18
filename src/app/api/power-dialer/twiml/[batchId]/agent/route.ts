import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { getBatchById } from "@/lib/power-dialer/queries";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const { batchId } = await params;

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
