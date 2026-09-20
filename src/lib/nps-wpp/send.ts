import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppGroupMessage } from "@/lib/weekly-reports/evolution-api";
import { getTodayDate } from "@/lib/datetime/timezone";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://sistemaacompanha.yidedigital.com.br";

export async function sendNpsWhatsApp(): Promise<{
  sent: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient();
  const today = getTodayDate();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const cutoff = threeMonthsAgo.toISOString();

  const { data: clients } = await sb
    .from("clients")
    .select("id, nome, grupo_wpp_jid, contato_principal")
    .eq("status", "ativo")
    .not("grupo_wpp_jid", "is", null)
    .order("nome");

  let sent = 0;
  let skipped = 0;

  for (const client of clients ?? []) {
    if (!client.grupo_wpp_jid) {
      skipped++;
      continue;
    }

    const { data: recentNps } = await sb
      .from("client_self_satisfaction")
      .select("submitted_at")
      .eq("client_id", client.id)
      .gte("submitted_at", cutoff)
      .limit(1);

    if (recentNps && recentNps.length > 0) {
      skipped++;
      continue;
    }

    const { data: alreadySent } = await sb
      .from("cron_runs")
      .select("ran_at")
      .eq("job_name", `nps-wpp-${client.id}`)
      .eq("run_date", today)
      .maybeSingle();

    if (alreadySent) {
      skipped++;
      continue;
    }

    const portalLink = `${APP_URL}/portal`;
    const nome = client.contato_principal || client.nome;

    const message = [
      `⭐ *Como estamos indo?*`,
      "",
      `Olá${nome ? `, *${nome}*` : ""}!`,
      "",
      `Queremos saber como está sua experiência com a Yide Digital.`,
      `Sua opinião é muito importante pra gente! 🙏`,
      "",
      `📝 Acesse seu portal e avalie de 0 a 10:`,
      portalLink,
      "",
      `Leva menos de 1 minuto! 💙`,
    ].join("\n");

    const result = await sendWhatsAppGroupMessage(
      client.grupo_wpp_jid,
      message,
    );

    if (result.success) {
      await sb.from("cron_runs").insert({
        job_name: `nps-wpp-${client.id}`,
        run_date: today,
      });
      sent++;
    }
  }

  return { sent, skipped };
}
