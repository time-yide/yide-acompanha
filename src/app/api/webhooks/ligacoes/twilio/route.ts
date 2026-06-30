import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";
import { parseEventoWebhookTwilio, buildRecordingProxyUrl } from "@/lib/ligacoes/twilio";

// Webhook público autenticado por ?secret= (= ligacoes_instancias.webhook_secret).
// Recebe Content-Type application/x-www-form-urlencoded da Twilio.
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret) return NextResponse.json({ error: "missing secret" }, { status: 401 });

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

  let payload: Record<string, unknown> = {};
  try {
    const form = await req.formData();
    payload = Object.fromEntries(form.entries());
  } catch {
    return NextResponse.json({ ok: true });
  }

  const ev = parseEventoWebhookTwilio(payload);
  if (!ev.externalId) return NextResponse.json({ ok: true });

  try {
    const { data: existing } = await sb
      .from("ligacoes")
      .select("id, gravacao_url, duracao_segundos")
      .eq("origem", "twilio")
      .eq("external_id", ev.externalId)
      .maybeSingle();
    if (!existing) return NextResponse.json({ ok: true });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: Record<string, any> = {
      finalizada_em: new Date().toISOString(),
      raw_data: ev.raw,
    };
    if (ev.recordingSid) {
      const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL;
      patch.gravacao_url = buildRecordingProxyUrl(appUrl, ev.recordingSid, secret);
    }
    if (ev.duracaoSegundos > 0) patch.duracao_segundos = ev.duracaoSegundos;
    if (payload.DialCallStatus != null || payload.CallStatus != null) {
      patch.status = ev.statusInterno;
    }

    await sb.from("ligacoes").update(patch).eq("id", (existing as { id: string }).id);
    return NextResponse.json({ ok: true, updated: true });
  } catch (e) {
    console.error("[webhook twilio] erro:", (e as Error).message);
    return NextResponse.json({ ok: true });
  }
}
