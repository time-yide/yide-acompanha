import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";
import { mapStatusApi4Com } from "@/lib/ligacoes/api4com";

export const dynamic = "force-dynamic";

interface Api4ComWebhookPayload {
  version: string;
  eventType: string;
  id: string;
  domain: string;
  direction: string;
  caller: string;
  called: string;
  startedAt: string;
  answeredAt: string | null;
  endedAt: string;
  duration: number;
  hangupCause: string;
  hangupCauseCode: string;
  recordUrl: string | null;
  metadata?: {
    gateway?: string;
    ligacao_id?: string;
    colaborador_id?: string;
    lead_id?: string;
    lead_gerado_id?: string;
    [key: string]: unknown;
  };
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  const expected = getServerEnv().API4COM_WEBHOOK_SECRET;

  if (!expected || !secret || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: Api4ComWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.eventType !== "channel-hangup") {
    return NextResponse.json({ ok: true, skipped: "not channel-hangup" });
  }

  if (payload.metadata?.gateway !== "yide-acompanha") {
    return NextResponse.json({ ok: true, skipped: "not our gateway" });
  }

  const ligacaoId = payload.metadata?.ligacao_id;
  if (!ligacaoId) {
    console.warn("[api4com-webhook] channel-hangup sem ligacao_id no metadata");
    return NextResponse.json({ ok: true, skipped: "no ligacao_id" });
  }

  const statusInterno = mapStatusApi4Com(payload.hangupCause, payload.duration);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;

  const update: Record<string, unknown> = {
    status: statusInterno,
    duracao_segundos: payload.duration,
    finalizada_em: payload.endedAt || new Date().toISOString(),
    external_id: payload.id,
    raw_data: {
      eventType: payload.eventType,
      id: payload.id,
      direction: payload.direction,
      caller: payload.caller,
      called: payload.called,
      startedAt: payload.startedAt,
      answeredAt: payload.answeredAt,
      endedAt: payload.endedAt,
      duration: payload.duration,
      hangupCause: payload.hangupCause,
      hangupCauseCode: payload.hangupCauseCode,
    },
  };

  if (payload.recordUrl && /^https:\/\//.test(payload.recordUrl)) {
    update.gravacao_url = payload.recordUrl;
  }

  const { error } = await sb
    .from("ligacoes")
    .update(update)
    .eq("id", ligacaoId);

  if (error) {
    console.error("[api4com-webhook] update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Se tinha lead_gerado_id, atualiza contagem de tentativas
  const leadGeradoId = payload.metadata?.lead_gerado_id;
  if (leadGeradoId) {
    if (statusInterno === "atendida") {
      await sb
        .from("leads_gerados")
        .update({ ai_status: "convertido", ai_ultima_ligacao: new Date().toISOString() })
        .eq("id", leadGeradoId);
    } else {
      await sb
        .from("leads_gerados")
        .update({ ai_status: null, ai_ultima_ligacao: new Date().toISOString() })
        .eq("id", leadGeradoId);
    }
  }

  return NextResponse.json({ ok: true, ligacaoId, status: statusInterno });
}
