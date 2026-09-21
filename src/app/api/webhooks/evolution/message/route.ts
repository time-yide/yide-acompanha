import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
      participant?: string;
    };
    pushName?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
    };
    messageTimestamp?: number;
  };
}

export async function POST(req: Request) {
  const apiKey = process.env.EVOLUTION_API_KEY;
  const headerKey = req.headers.get("apikey");
  if (apiKey && headerKey && headerKey !== apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: EvolutionWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.event !== "messages.upsert") {
    return NextResponse.json({ ok: true, ignored: payload.event });
  }

  const { data } = payload;
  const jid = data.key.remoteJid;

  if (!jid?.includes("@g.us")) {
    return NextResponse.json({ ok: true, ignored: "not a group" });
  }

  if (data.key.fromMe) {
    return NextResponse.json({ ok: true, ignored: "own message" });
  }

  const text =
    data.message?.conversation ||
    data.message?.extendedTextMessage?.text ||
    null;

  if (!text || text.trim().length < 3) {
    return NextResponse.json({ ok: true, ignored: "no text" });
  }

  const sb = createServiceRoleClient() as SB;

  const { data: client } = await sb
    .from("clients")
    .select("id, organization_id")
    .eq("grupo_wpp_jid", jid)
    .maybeSingle();

  if (!client) {
    return NextResponse.json({ ok: true, ignored: "unknown group" });
  }

  const senderPhone = data.key.participant
    ?.replace("@s.whatsapp.net", "")
    ?? null;

  await sb.from("client_group_messages").insert({
    organization_id: client.organization_id,
    client_id: client.id,
    group_jid: jid,
    sender_name: data.pushName ?? null,
    sender_phone: senderPhone,
    message_text: text.trim().slice(0, 2000),
    received_at: data.messageTimestamp
      ? new Date(data.messageTimestamp * 1000).toISOString()
      : new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, stored: true });
}
