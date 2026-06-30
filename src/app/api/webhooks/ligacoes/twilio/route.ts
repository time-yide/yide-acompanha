import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";
import {
  parseEventoWebhookTwilio,
  buildRecordingProxyUrl,
  validarAssinaturaTwilio,
} from "@/lib/ligacoes/twilio";

// Webhook público autenticado por ?secret= + validação de X-Twilio-Signature.
// Recebe application/x-www-form-urlencoded da Twilio.
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret) return NextResponse.json({ error: "missing secret" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data: inst } = await sb
    .from("ligacoes_instancias")
    .select("id, organization_id, colaborador_id")
    .eq("webhook_secret", secret)
    .eq("provedor", "twilio")
    .is("arquivado_em", null)
    .maybeSingle();
  if (!inst) return NextResponse.json({ error: "invalid secret" }, { status: 401 });

  let params: Record<string, string> = {};
  try {
    const form = await req.formData();
    params = Object.fromEntries(form.entries()) as Record<string, string>;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL;
  const sigOk = validarAssinaturaTwilio(
    req.headers.get("x-twilio-signature"),
    `${appUrl.replace(/\/$/, "")}/api/webhooks/ligacoes/twilio?secret=${secret}`,
    params,
  );
  if (!sigOk) return NextResponse.json({ error: "bad signature" }, { status: 403 });

  const ev = parseEventoWebhookTwilio(params);
  if (!ev.externalId) return NextResponse.json({ ok: true });

  try {
    const { data: existing } = await sb
      .from("ligacoes")
      .select("id")
      .eq("origem", "twilio")
      .eq("external_id", ev.externalId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: Record<string, any> = {
      finalizada_em: new Date().toISOString(),
      raw_data: ev.raw,
    };
    if (ev.recordingSid) {
      patch.gravacao_url = buildRecordingProxyUrl(appUrl, ev.recordingSid, ev.externalId);
    }
    if (ev.duracaoSegundos > 0) patch.duracao_segundos = ev.duracaoSegundos;
    // Status só vem do callback de <Dial action> (tem DialCallStatus). O callback
    // de gravação não traz status de chamada — não deixar sobrescrever.
    if (params.DialCallStatus != null) patch.status = ev.statusInterno;

    if (existing) {
      await sb.from("ligacoes").update(patch).eq("id", (existing as { id: string }).id);
      return NextResponse.json({ ok: true, updated: true });
    }

    // Upsert-on-missing: se a linha do voice route não existir (corrida/falha),
    // cria pra não perder o resultado (espelha o webhook da Zenvia).
    await sb.from("ligacoes").insert({
      organization_id: inst.organization_id,
      tipo: "telefone",
      direcao: "saida",
      colaborador_id: inst.colaborador_id,
      instancia_id: inst.id,
      numero: String(params.To ?? params.Called ?? "desconhecido"),
      status: params.DialCallStatus != null ? ev.statusInterno : "em_andamento",
      iniciada_em: new Date().toISOString(),
      finalizada_em: new Date().toISOString(),
      duracao_segundos: ev.duracaoSegundos,
      gravacao_url: ev.recordingSid ? buildRecordingProxyUrl(appUrl, ev.recordingSid, ev.externalId) : null,
      origem: "twilio",
      external_id: ev.externalId,
      raw_data: ev.raw,
    });
    return NextResponse.json({ ok: true, created: true });
  } catch (e) {
    console.error("[webhook twilio] erro:", (e as Error).message);
    return NextResponse.json({ ok: true });
  }
}
