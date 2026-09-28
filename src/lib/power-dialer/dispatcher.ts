import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getApi4ComCreds, api4comFazerLigacao } from "@/lib/ligacoes/api4com";
import { getPowerDialerConfig, getActiveBatchForColaborador } from "./queries";
import { PD_BATCH_STATUS } from "./types";
import type { LeadParaProspectar } from "@/lib/motor-prospeccao/types";
import { getServerEnv } from "@/lib/env";

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
  const creds = getApi4ComCreds();
  if (!creds) return { error: "API4COM não configurado" };

  const config = await getPowerDialerConfig(orgId);
  if (!config?.power_dialer_ativo)
    return { error: "Power dialer não ativo" };
  if (!config.power_dialer_colaborador_id)
    return { error: "Sem colaborador definido para power dialer" };

  const active = await getActiveBatchForColaborador(config.power_dialer_colaborador_id);
  if (active) return { error: "Batch ativo em andamento" };

  const conferenceName = `pd-${crypto.randomUUID().slice(0, 8)}`;
  const env = getServerEnv();
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

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

  const leadIds = leads.map((l) => l.id);
  await sb()
    .from("leads_gerados")
    .update({ ai_status: "em_ligacao" })
    .in("id", leadIds);

  // API4COM: discagem sequencial — chama o primeiro lead, e o webhook
  // avança pro próximo. POST /calls toca o ramal → agente atende → disca lead.
  const firstLead = leads[0];
  const telefone = firstLead.telefone || firstLead.whatsapp;
  if (!telefone) {
    await sb().from("power_dialer_batches")
      .update({ status: PD_BATCH_STATUS.ERRO, finalizado_em: new Date().toISOString() })
      .eq("id", batchId);
    await sb().from("leads_gerados").update({ ai_status: null }).in("id", leadIds);
    return { error: "Lead sem telefone" };
  }

  const { data: batchCall } = await sb()
    .from("power_dialer_batch_calls")
    .insert({
      batch_id: batchId,
      lead_gerado_id: firstLead.id,
      status: "discando",
    })
    .select("id")
    .single();

  const webhookSecret = env.API4COM_WEBHOOK_SECRET || "";

  const result = await api4comFazerLigacao({
    caller: creds.defaultExtension,
    called: telefone,
    extension: creds.defaultExtension,
    metadata: {
      gateway: "yide-acompanha",
      batch_id: batchId,
      lead_gerado_id: firstLead.id,
      batch_call_id: batchCall?.id,
      colaborador_id: config.power_dialer_colaborador_id,
      webhook_url: `${appUrl}/api/webhooks/api4com?secret=${webhookSecret}`,
    },
  });

  if ("error" in result) {
    if (batchCall) {
      await sb().from("power_dialer_batch_calls")
        .update({ status: "erro", finalizado_em: new Date().toISOString() })
        .eq("id", batchCall.id);
    }
    await sb().from("power_dialer_batches")
      .update({ status: PD_BATCH_STATUS.ERRO, finalizado_em: new Date().toISOString() })
      .eq("id", batchId);
    await sb().from("leads_gerados").update({ ai_status: null }).in("id", leadIds);
    return { error: result.error };
  }

  if (batchCall) {
    await sb().from("power_dialer_batch_calls")
      .update({ twilio_call_sid: result.callId })
      .eq("id", batchCall.id);
  }

  return { success: true, batchId, callCount: 1 };
}
