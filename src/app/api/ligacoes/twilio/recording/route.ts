import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { getTwilioCreds, RECORDING_SID_RE } from "@/lib/ligacoes/twilio";
import { getServerEnv } from "@/lib/env";

export async function GET(req: NextRequest) {
  const sid = req.nextUrl.searchParams.get("sid");
  const call = req.nextUrl.searchParams.get("call");
  if (!call) {
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
  const orgId = (profile as { organization_id: string }).organization_id;

  const { data: lig } = await sb
    .from("ligacoes")
    .select("organization_id")
    .in("origem", ["twilio", "voz_ia"])
    .eq("external_id", call)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!lig || (lig as { organization_id: string }).organization_id !== orgId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const creds = getTwilioCreds();
  if (!creds) return NextResponse.json({ error: "twilio off" }, { status: 503 });
  const auth = Buffer.from(`${creds.apiKeySid}:${creds.apiKeySecret}`).toString("base64");

  let recordingSid = sid;

  if (!recordingSid || !RECORDING_SID_RE.test(recordingSid)) {
    const env = getServerEnv();
    const listUrl = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Calls/${call}/Recordings.json?PageSize=1`;
    const listResp = await fetch(listUrl, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
      },
    });
    if (!listResp.ok) {
      return NextResponse.json({ error: "recording not found" }, { status: 404 });
    }
    const listData = (await listResp.json()) as {
      recordings?: { sid: string }[];
    };
    recordingSid = listData.recordings?.[0]?.sid ?? null;
    if (!recordingSid) {
      return NextResponse.json(
        { error: "no recording for this call" },
        { status: 404 },
      );
    }
  }

  const mediaUrl = `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Recordings/${recordingSid}.mp3`;
  const res = await fetch(mediaUrl, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok || !res.body) {
    return NextResponse.json(
      { error: "recording fetch failed" },
      { status: 502 },
    );
  }

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
