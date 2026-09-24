import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";
import { validarAssinaturaTwilio } from "@/lib/ligacoes/twilio";
import { getBatchById, getBatchCalls } from "@/lib/power-dialer/queries";
import { notificarAgente } from "@/lib/power-dialer/notify";
import { PD_BATCH_STATUS, PD_CALL_STATUS } from "@/lib/power-dialer/types";
import type { PDBatch } from "@/lib/power-dialer/types";
import { incrementLeadScore } from "@/lib/motor-prospeccao/lead-score";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return createServiceRoleClient() as any; }

/**
 * Webhook de status da Conference do Power Dialer (join/leave/end). Chamado
 * pelo Twilio a partir do `statusCallback` configurado no <Dial><Conference>
 * das rotas TwiML (twiml/[batchId]/lead e /agent).
 *
 * Sempre responde TwiML vazio (não JSON) — Twilio exige isso mesmo sendo
 * um callback assíncrono, senão registra erro no log da call (#547).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const { batchId } = await params;
  const env = getServerEnv();
  const form = await req.formData();
  const p: Record<string, string> = {};
  form.forEach((v, k) => { p[k] = String(v); });

  const sig = req.headers.get("x-twilio-signature");
  const webhookUrl = `${env.NEXT_PUBLIC_APP_URL}/api/power-dialer/conference-event/${batchId}`;
  if (!validarAssinaturaTwilio(sig, webhookUrl, p)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const event = p.StatusCallbackEvent ?? "";
  const callSid = p.CallSid ?? "";

  const batch = await getBatchById(batchId);
  if (!batch) return twimlOk();

  if (event === "participant-join" && batch.status === PD_BATCH_STATUS.DISCANDO) {
    await handleFirstAnswer(batchId, batch, callSid);
  } else if (event === "participant-leave" || event === "conference-end") {
    await handleEnd(batchId, batch);
  }

  return twimlOk();
}

async function handleFirstAnswer(
  batchId: string,
  batch: PDBatch,
  callSid: string,
) {
  const env = getServerEnv();
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  const calls = await getBatchCalls(batchId);
  const answeredCall = calls.find((c) => c.twilio_call_sid === callSid);
  if (!answeredCall) return;

  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    console.error("[power-dialer] Twilio não configurado no conference-event");
    return;
  }
  const authHeader = `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}`;

  // Busca instância + lead em paralelo — necessários pra conectar o agente
  const [{ data: instancia }, { data: lead }] = await Promise.all([
    sb()
      .from("ligacoes_instancias")
      .select("numero")
      .eq("organization_id", batch.organization_id)
      .eq("provedor", "twilio")
      .is("arquivado_em", null)
      .limit(1)
      .maybeSingle(),
    sb()
      .from("leads_gerados")
      .select("decisor_nome, empresa, categoria, cidade")
      .eq("id", answeredCall.lead_gerado_id)
      .single(),
  ]);

  const fromNumber = instancia?.numero;
  if (!fromNumber) {
    console.error("[power-dialer] nenhuma instância Twilio encontrada pra org", batch.organization_id);
  }

  // Conecta o agente à conference + notifica — ANTES de dropar as outras
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Calls.json`;
  const [callRes] = await Promise.all([
    fromNumber
      ? fetch(twilioUrl, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: `client:${batch.colaborador_id}`,
            From: fromNumber,
            Url: `${appUrl}/api/power-dialer/twiml/${batchId}/agent`,
          }).toString(),
        })
      : Promise.resolve(null),
    notificarAgente(batch.colaborador_id, {
      type: "power_dialer_lead_answered",
      batchId,
      leadNome: lead?.decisor_nome ?? "",
      leadEmpresa: lead?.empresa ?? "Lead",
      leadCategoria: lead?.categoria ?? null,
      leadCidade: lead?.cidade ?? null,
    }),
  ]);

  if (callRes && !callRes.ok) {
    const body = await callRes.text().catch(() => "");
    console.error("[power-dialer] falha ao ligar pro Device do agente:", callRes.status, body);
  }
  if (!callRes) {
    console.error("[power-dialer] chamada ao agente não enviada — sem número From");
  }

  // DB updates e drop das outras calls em paralelo (não bloqueia o agente)
  await Promise.all([
    sb().from("power_dialer_batches").update({
      status: PD_BATCH_STATUS.CONECTADO,
      lead_atendeu_id: answeredCall.lead_gerado_id,
      conectado_em: new Date().toISOString(),
    }).eq("id", batchId),
    sb().from("power_dialer_batch_calls").update({
      status: PD_CALL_STATUS.ATENDEU,
      atendeu_em: new Date().toISOString(),
    }).eq("id", answeredCall.id),
    incrementLeadScore(answeredCall.lead_gerado_id, 20),
  ]);

  // Derruba as outras ligações em paralelo
  const otherCalls = calls.filter((c) => c.id !== answeredCall.id && c.twilio_call_sid);
  await Promise.all(otherCalls.map(async (other) => {
    try {
      await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Calls/${other.twilio_call_sid}.json`,
        {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ Status: "completed" }).toString(),
        },
      );
      await Promise.all([
        sb().from("power_dialer_batch_calls").update({
          status: PD_CALL_STATUS.DROPADO,
          finalizado_em: new Date().toISOString(),
        }).eq("id", other.id),
        sb().from("leads_gerados").update({
          ai_status: null,
          dropado_power_dialer: true,
          ai_proxima_tentativa: new Date().toISOString(),
        }).eq("id", other.lead_gerado_id),
        incrementLeadScore(other.lead_gerado_id, 15),
      ]);
    } catch (err) {
      console.error("[power-dialer] erro ao dropar call:", err);
    }
  }));
}

async function handleEnd(batchId: string, batch: PDBatch) {
  if (batch.status === PD_BATCH_STATUS.CONCLUIDO || batch.status === PD_BATCH_STATUS.ERRO) return;

  await sb().from("power_dialer_batches").update({
    status: PD_BATCH_STATUS.CONCLUIDO,
    finalizado_em: new Date().toISOString(),
  }).eq("id", batchId);
}

function twimlOk() {
  return new NextResponse("<Response/>", {
    headers: { "Content-Type": "text/xml" },
  });
}
