import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getTwilioCreds } from "@/lib/ligacoes/twilio";

export async function GET(req: NextRequest) {
  const sid = req.nextUrl.searchParams.get("sid");
  const secret = req.nextUrl.searchParams.get("secret");
  if (!sid || !secret) {
    return NextResponse.json({ error: "missing params" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data: inst } = await sb
    .from("ligacoes_instancias")
    .select("id")
    .eq("webhook_secret", secret)
    .eq("provedor", "twilio")
    .is("arquivado_em", null)
    .maybeSingle();
  if (!inst) return NextResponse.json({ error: "invalid secret" }, { status: 401 });

  const creds = getTwilioCreds();
  if (!creds) return NextResponse.json({ error: "twilio off" }, { status: 503 });

  const mediaUrl = `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Recordings/${sid}.mp3`;
  const auth = Buffer.from(`${creds.apiKeySid}:${creds.apiKeySecret}`).toString("base64");
  const res = await fetch(mediaUrl, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok || !res.body) {
    return NextResponse.json({ error: "recording fetch failed" }, { status: 502 });
  }

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
