import "server-only";
import { getServerEnv } from "@/lib/env";
import { enviarViaTwilioWpp } from "@/lib/motor-prospeccao/enviar-wpp";
import { getActiveOrgIds } from "@/lib/relatorios-auto/recipients";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getOverdueTasksByUser } from "./queries";
import { formatLembreteTarefas } from "./format";

interface SendResult {
  orgId: string;
  sent: number;
  errors: string[];
}

export async function sendLembretesTarefas(): Promise<SendResult[]> {
  const orgIds = await getActiveOrgIds();
  const results: SendResult[] = [];
  const env = getServerEnv();
  const statusUrl = `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/wpp/twilio/status`;
  const appUrl = env.NEXT_PUBLIC_APP_URL ?? "https://sistemaacompanha.yidedigital.com.br";

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
      results.push({ orgId, sent: 0, errors: ["twilio_wpp_from nao configurado"] });
      continue;
    }

    const users = await getOverdueTasksByUser(orgId);
    let totalSent = 0;
    const allErrors: string[] = [];

    for (const user of users) {
      const message = formatLembreteTarefas(user, appUrl);
      const result = await enviarViaTwilioWpp(user.telefone, twilioFrom, message, statusUrl);
      if ("error" in result) {
        allErrors.push(`${user.nome}: ${result.error}`);
      } else {
        totalSent++;
      }
    }

    results.push({ orgId, sent: totalSent, errors: allErrors });
  }

  return results;
}
