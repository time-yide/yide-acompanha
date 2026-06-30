import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { getTwilioCreds, RECORDING_SID_RE } from "@/lib/ligacoes/twilio";

// Servido pro player <audio> do detalhe da ligação. Autentica pela SESSÃO do
// usuário (cookies) + confere que a ligação é da org dele. Não usa segredo na
// URL (que iria parar no DOM).
export async function GET(req: NextRequest) {
  const sid = req.nextUrl.searchParams.get("sid");
  const call = req.nextUrl.searchParams.get("call");
  if (!sid || !call || !RECORDING_SID_RE.test(sid)) {
    return NextResponse.json({ error: "bad params" }, { status: 400 });
  }

  const actor = await requireAuth();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data: profile } = await sb
    .from("profiles")
    .select("organization_id")
    .eq("id", actor.id)
    .single();
  if (!profile) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data: lig } = await sb
    .from("ligacoes")
    .select("organization_id")
    .eq("origem", "twilio")
    .eq("external_id", call)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!lig || (lig as { organization_id: string }).organization_id !== (profile as { organization_id: string }).organization_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

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
