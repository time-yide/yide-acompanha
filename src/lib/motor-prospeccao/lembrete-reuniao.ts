import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";

function sb() {
  return createServiceRoleClient() as any;
}

export async function enviarLembretesReuniao(): Promise<number> {
  const env = getServerEnv();
  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return 0;

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: events } = await sb()
    .from("calendar_events")
    .select("id, organization_id, titulo, inicio")
    .eq("origem", "lead_prospeccao")
    .eq("sub_calendar", "comercial")
    .eq("lembrete_ia_enviado", false)
    .gte("inicio", now.toISOString())
    .lte("inicio", in24h.toISOString());

  if (!events || events.length === 0) return 0;

  let sent = 0;

  for (const event of events) {
    const { data: log } = await sb()
      .from("motor_prospeccao_log")
      .select("detalhes, lead_gerado_id")
      .eq("organization_id", event.organization_id)
      .eq("acao", "reuniao_agendada")
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!log?.detalhes?.conversation_id) continue;

    const convId = log.detalhes.conversation_id;
    const { data: conv } = await sb()
      .from("wpp_conversations")
      .select("contato_telefone, twilio_from, contato_nome")
      .eq("id", convId)
      .single();

    if (!conv?.twilio_from || !conv?.contato_telefone) continue;

    const meetingDate = new Date(event.inicio);
    const hora = meetingDate.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Cuiaba",
    });
    const dia = meetingDate.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "America/Cuiaba",
    });

    const nome = conv.contato_nome ? ` ${conv.contato_nome.split(" ")[0]}` : "";
    const texto = `Oi${nome}! Lembrando da nossa reunião ${dia} às ${hora}. Até lá!`;

    const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const twilioParams = new URLSearchParams({
      From: `whatsapp:${conv.twilio_from}`,
      To: `whatsapp:${conv.contato_telefone}`,
      Body: texto,
      StatusCallback: `${appUrl}/api/webhooks/wpp/twilio/status`,
    });

    const resp = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: twilioParams.toString(),
    });

    if (resp.ok) {
      const result = await resp.json();

      await sb().from("wpp_messages").insert({
        conversation_id: convId,
        organization_id: event.organization_id,
        autor: "sistema",
        texto,
        twilio_sid: result.sid ?? null,
        status: "enviada",
      });

      await sb()
        .from("calendar_events")
        .update({ lembrete_ia_enviado: true })
        .eq("id", event.id);

      sent++;
    }
  }

  return sent;
}
