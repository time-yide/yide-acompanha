import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";
import { getPowerDialerConfig, getActiveBatchForColaborador } from "./queries";
import { PD_BATCH_STATUS } from "./types";
import type { LeadParaProspectar } from "@/lib/motor-prospeccao/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return createServiceRoleClient() as any; }

interface DispatchResult {
  success: true;
  batchId: string;
  callCount: number;
}
interface DispatchError {
  error: string;
}
export type PowerDialerResult = DispatchResult | DispatchError;

export async function dispararPowerDialerBatch(
  orgId: string,
  leads: LeadParaProspectar[],
): Promise<PowerDialerResult> {
  const env = getServerEnv();
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN)
    return { error: "Twilio não configurado" };

  const config = await getPowerDialerConfig(orgId);
  if (!config?.power_dialer_ativo)
    return { error: "Power dialer não ativo" };
  if (!config.power_dialer_colaborador_id)
    return { error: "Sem colaborador definido para power dialer" };

  // Não permitir dois batches simultâneos pro mesmo colaborador
  const active = await getActiveBatchForColaborador(config.power_dialer_colaborador_id);
  if (active) return { error: "Batch ativo em andamento" };

  // Buscar instância Twilio da org
  const { data: instancia } = await sb()
    .from("ligacoes_instancias")
    .select("numero, id")
    .eq("organization_id", orgId)
    .eq("provedor", "twilio")
    .is("arquivado_em", null)
    .limit(1)
    .maybeSingle();
  if (!instancia?.numero) return { error: "Sem instância Twilio" };

  const conferenceName = `pd-${crypto.randomUUID().slice(0, 8)}`;
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  // Criar batch no banco
  const { data: batch, error: batchErr } = await sb()
    .from("power_dialer_batches")
    .insert({
      organization_id: orgId,
      conference_name: conferenceName,
      status: PD_BATCH_STATUS.DISCANDO,
      colaborador_id: config.power_dialer_colaborador_id,
    })
    .select("id")
    .single();
  if (batchErr || !batch) return { error: batchErr?.message ?? "Erro ao criar batch" };

  const batchId = batch.id;

  // Marcar leads como em_ligacao
  const leadIds = leads.map((l) => l.id);
  await sb()
    .from("leads_gerados")
    .update({ ai_status: "em_ligacao" })
    .in("id", leadIds);

  // Discar todas simultaneamente
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Calls.json`;
  const authHeader = `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}`;

  const callPromises = leads.map(async (lead) => {
    const telefone = lead.telefone || lead.whatsapp;
    if (!telefone) return null;

    // Criar registro da call no batch
    const { data: batchCall } = await sb()
      .from("power_dialer_batch_calls")
      .insert({
        batch_id: batchId,
        lead_gerado_id: lead.id,
        status: "discando",
      })
      .select("id")
      .single();
    if (!batchCall) return null;

    const body = new URLSearchParams({
      To: telefone,
      From: instancia.numero,
      Url: `${appUrl}/api/power-dialer/twiml/${batchId}/lead`,
      StatusCallback: `${appUrl}/api/power-dialer/status/${batchId}`,
      StatusCallbackEvent: "initiated ringing answered completed",
    });

    try {
      const resp = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        await sb().from("power_dialer_batch_calls")
          .update({ status: "erro", finalizado_em: new Date().toISOString() })
          .eq("id", batchCall.id);
        console.error("[power-dialer] Twilio call error:", errText);
        return null;
      }

      const twilioData = await resp.json();
      await sb().from("power_dialer_batch_calls")
        .update({ twilio_call_sid: twilioData.sid })
        .eq("id", batchCall.id);
      return batchCall.id;
    } catch (err) {
      console.error("[power-dialer] dispatch error:", err);
      return null;
    }
  });

  const results = await Promise.all(callPromises);
  const successCount = results.filter(Boolean).length;

  if (successCount === 0) {
    await sb().from("power_dialer_batches")
      .update({ status: PD_BATCH_STATUS.ERRO, finalizado_em: new Date().toISOString() })
      .eq("id", batchId);
    await sb().from("leads_gerados").update({ ai_status: null }).in("id", leadIds);
    return { error: "Nenhuma ligação iniciada" };
  }

  return { success: true, batchId, callCount: successCount };
}
