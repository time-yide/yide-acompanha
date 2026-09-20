import "server-only";
import { getServerEnv } from "@/lib/env";
import { enviarViaTwilioWpp } from "@/lib/motor-prospeccao/enviar-wpp";
import { getActiveOrgIds } from "@/lib/relatorios-auto/recipients";
import { normalizeTelefone } from "@/lib/dispatch/render-template";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getClientMonthlyReports } from "./queries";
import { formatRelatorioMensalCliente } from "./format";

interface SendResult {
  orgId: string;
  sent: number;
  errors: string[];
}

export async function sendRelatorioMensalClientes(): Promise<SendResult[]> {
  const orgIds = await getActiveOrgIds();
  const results: SendResult[] = [];
  const env = getServerEnv();
  const statusUrl = `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/wpp/twilio/status`;

  const now = new Date();
  const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const mesRef = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}`;
  const mesInicio = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(prevYear, prevMonth + 1, 0).getDate();
  const mesFim = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const prevPrevMonth = prevMonth === 0 ? 11 : prevMonth - 1;
  const prevPrevYear = prevMonth === 0 ? prevYear - 1 : prevYear;
  const mesAnteriorInicio = `${prevPrevYear}-${String(prevPrevMonth + 1).padStart(2, "0")}-01`;
  const lastDayPrev = new Date(prevPrevYear, prevPrevMonth + 1, 0).getDate();
  const mesAnteriorFim = `${prevPrevYear}-${String(prevPrevMonth + 1).padStart(2, "0")}-${String(lastDayPrev).padStart(2, "0")}`;

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

    const reports = await getClientMonthlyReports(orgId, mesInicio, mesFim, mesAnteriorInicio, mesAnteriorFim);
    let totalSent = 0;
    const allErrors: string[] = [];

    for (const report of reports) {
      const tel = normalizeTelefone(report.telefone);
      if (!tel) continue;

      const message = formatRelatorioMensalCliente(report, mesRef);
      const result = await enviarViaTwilioWpp(tel, twilioFrom, message, statusUrl);
      if ("error" in result) {
        allErrors.push(`${report.clienteNome}: ${result.error}`);
      } else {
        totalSent++;
      }
    }

    results.push({ orgId, sent: totalSent, errors: allErrors });
  }

  return results;
}
