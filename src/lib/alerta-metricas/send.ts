import "server-only";
import { getServerEnv } from "@/lib/env";
import { enviarViaTwilioWpp } from "@/lib/motor-prospeccao/enviar-wpp";
import { getActiveOrgIds } from "@/lib/relatorios-auto/recipients";
import { normalizeTelefone } from "@/lib/dispatch/render-template";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getClientsWithMetricsDrop } from "./queries";
import { formatAlertaQueda } from "./format";

interface SendResult {
  orgId: string;
  sent: number;
  clientsAlerted: number;
  errors: string[];
}

export async function sendAlertasQueda(): Promise<SendResult[]> {
  const orgIds = await getActiveOrgIds();
  const results: SendResult[] = [];
  const env = getServerEnv();
  const statusUrl = `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/wpp/twilio/status`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;

  for (const orgId of orgIds) {
    const { data: configData } = await sb
      .from("ai_voice_configs")
      .select("twilio_wpp_from")
      .eq("organization_id", orgId)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();

    const twilioFrom = (configData as { twilio_wpp_from?: string } | null)?.twilio_wpp_from ?? null;
    if (!twilioFrom) {
      results.push({ orgId, sent: 0, clientsAlerted: 0, errors: ["twilio_wpp_from nao configurado"] });
      continue;
    }

    const drops = await getClientsWithMetricsDrop(orgId);
    if (drops.length === 0) {
      results.push({ orgId, sent: 0, clientsAlerted: 0, errors: [] });
      continue;
    }

    const byAssessor = new Map<string, typeof drops>();
    for (const d of drops) {
      if (!d.assessorId || !d.assessorTelefone) continue;
      const list = byAssessor.get(d.assessorId) ?? [];
      list.push(d);
      byAssessor.set(d.assessorId, list);
    }

    let totalSent = 0;
    const allErrors: string[] = [];

    for (const [, clientList] of byAssessor) {
      const assessor = clientList[0];
      if (!assessor.assessorTelefone || !assessor.assessorNome) continue;

      const tel = normalizeTelefone(assessor.assessorTelefone);
      if (!tel) continue;

      const message = formatAlertaQueda(assessor.assessorNome, clientList);
      const result = await enviarViaTwilioWpp(tel, twilioFrom, message, statusUrl);
      if ("error" in result) {
        allErrors.push(`${assessor.assessorNome}: ${result.error}`);
      } else {
        totalSent++;
      }
    }

    results.push({ orgId, sent: totalSent, clientsAlerted: drops.length, errors: allErrors });
  }

  return results;
}
