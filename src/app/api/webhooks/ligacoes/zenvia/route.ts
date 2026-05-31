import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { parseEventoWebhook } from "@/lib/ligacoes/zenvia";

// Webhook público: autenticado pelo ?secret= (= ligacoes_instancias.webhook_secret).
// Idempotente por external_id. Sempre responde rápido (best-effort).
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret) return NextResponse.json({ error: "missing secret" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;

  const { data: inst } = await sb
    .from("ligacoes_instancias")
    .select("id, organization_id, colaborador_id, ramal, numero")
    .eq("webhook_secret", secret)
    .is("arquivado_em", null)
    .maybeSingle();
  if (!inst) return NextResponse.json({ error: "invalid secret" }, { status: 401 });

  let payload: Record<string, unknown> = {};
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const ev = parseEventoWebhook(payload);

  try {
    if (ev.externalId) {
      const { data: existing } = await sb
        .from("ligacoes")
        .select("id")
        .eq("origem", "totalvoice")
        .eq("external_id", ev.externalId)
        .maybeSingle();

      const patch = {
        status: ev.statusInterno,
        duracao_segundos: ev.duracaoSegundos,
        gravacao_url: ev.gravacaoUrl,
        finalizada_em: new Date().toISOString(),
        raw_data: ev.raw,
      };

      if (existing) {
        await sb.from("ligacoes").update(patch).eq("id", (existing as { id: string }).id);
        return NextResponse.json({ ok: true, updated: true });
      }
    }

    await sb.from("ligacoes").insert({
      organization_id: inst.organization_id,
      tipo: "telefone",
      direcao: "entrada",
      colaborador_id: inst.colaborador_id,
      instancia_id: inst.id,
      numero: String(payload.numero_origem ?? payload.numero ?? "desconhecido"),
      status: ev.statusInterno,
      iniciada_em: new Date().toISOString(),
      finalizada_em: new Date().toISOString(),
      duracao_segundos: ev.duracaoSegundos,
      gravacao_url: ev.gravacaoUrl,
      origem: "totalvoice",
      external_id: ev.externalId || null,
      raw_data: ev.raw,
    });
    return NextResponse.json({ ok: true, created: true });
  } catch (e) {
    console.error("[webhook zenvia] erro:", (e as Error).message);
    return NextResponse.json({ ok: true });
  }
}
