import "server-only";
import { getServerEnv } from "@/lib/env";
import { enviarViaTwilioWpp } from "@/lib/motor-prospeccao/enviar-wpp";
import { getReportRecipients, getActiveOrgIds, type Recipient } from "./recipients";
import { getWeeklyData } from "./weekly-data";
import { getMonthlyData } from "./monthly-data";
import { formatWeeklyForSector, formatWeeklyConsolidado } from "./format-weekly";
import { formatMonthlyConsolidado } from "./format-monthly";
import type { Setor } from "@/lib/produtividade/setor-metricas";

interface SendResult {
  orgId: string;
  sent: number;
  errors: string[];
}

async function sendToRecipients(
  recipients: Recipient[],
  message: string,
  twilioFrom: string,
): Promise<{ sent: number; errors: string[] }> {
  const env = getServerEnv();
  const statusUrl = `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/wpp/twilio/status`;
  let sent = 0;
  const errors: string[] = [];

  for (const r of recipients) {
    const result = await enviarViaTwilioWpp(r.telefone, twilioFrom, message, statusUrl);
    if ("error" in result) {
      errors.push(`${r.nome}: ${result.error}`);
    } else {
      sent++;
    }
  }

  return { sent, errors };
}

export async function sendWeeklyReports(): Promise<SendResult[]> {
  const orgIds = await getActiveOrgIds();
  const results: SendResult[] = [];

  for (const orgId of orgIds) {
    const { gestao, porSetor, twilioFrom } = await getReportRecipients(orgId);
    if (!twilioFrom) {
      results.push({ orgId, sent: 0, errors: ["twilio_wpp_from nao configurado"] });
      continue;
    }

    const data = await getWeeklyData(orgId);
    let totalSent = 0;
    const allErrors: string[] = [];

    for (const [setor, recipients] of Object.entries(porSetor) as [Setor, Recipient[]][]) {
      const message = formatWeeklyForSector(data, setor);
      if (!message || recipients.length === 0) continue;
      const { sent, errors } = await sendToRecipients(recipients, message, twilioFrom);
      totalSent += sent;
      allErrors.push(...errors);
    }

    if (gestao.length > 0) {
      const consolidado = formatWeeklyConsolidado(data);
      const { sent, errors } = await sendToRecipients(gestao, consolidado, twilioFrom);
      totalSent += sent;
      allErrors.push(...errors);
    }

    results.push({ orgId, sent: totalSent, errors: allErrors });
  }

  return results;
}

export async function sendMonthlyReports(): Promise<SendResult[]> {
  const orgIds = await getActiveOrgIds();
  const results: SendResult[] = [];

  const now = new Date();
  const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const m = now.getMonth() === 0 ? 12 : now.getMonth();
  const mesRef = `${y}-${String(m).padStart(2, "0")}`;

  for (const orgId of orgIds) {
    const { gestao, twilioFrom } = await getReportRecipients(orgId);
    if (!twilioFrom) {
      results.push({ orgId, sent: 0, errors: ["twilio_wpp_from nao configurado"] });
      continue;
    }

    if (gestao.length === 0) {
      results.push({ orgId, sent: 0, errors: ["nenhum gestor com telefone"] });
      continue;
    }

    const data = await getMonthlyData(mesRef);
    const message = formatMonthlyConsolidado(data);

    const { sent, errors } = await sendToRecipients(gestao, message, twilioFrom);
    results.push({ orgId, sent, errors });
  }

  return results;
}
