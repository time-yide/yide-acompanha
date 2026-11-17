import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppGroupMessage } from "@/lib/weekly-reports/evolution-api";
import { getTodayDate } from "@/lib/datetime/timezone";

export async function sendOnboardingWelcome(): Promise<{
  sent: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient();
  const today = getTodayDate();

  const { data: clients } = await sb
    .from("clients")
    .select("id, nome, grupo_wpp_jid, assessor_id, contato_principal")
    .eq("status", "em_onboarding")
    .order("created_at", { ascending: false });

  let sent = 0;
  let skipped = 0;

  for (const client of clients ?? []) {
    if (!client.grupo_wpp_jid) {
      skipped++;
      continue;
    }

    const { data: alreadySent } = await sb
      .from("cron_runs")
      .select("ran_at")
      .eq("job_name", `onboarding-wpp-${client.id}`)
      .maybeSingle();

    if (alreadySent) {
      skipped++;
      continue;
    }

    const nome = client.contato_principal || client.nome;

    const message = [
      `🎉 *Bem-vindo(a) à Yide Digital!*`,
      "",
      `Olá${nome ? `, *${nome}*` : ""}! Que bom ter você com a gente! 🚀`,
      "",
      `Seu processo de onboarding já começou e nossa equipe está preparando tudo pra você.`,
      "",
      `📋 *O que vai acontecer agora:*`,
      `• Cadastro e configuração da sua conta`,
      `• Reunião de alinhamento (marco zero)`,
      `• Início da produção de conteúdo`,
      `• Primeiras publicações`,
      "",
      `Qualquer dúvida, mande aqui neste grupo! Estamos à disposição. 💙`,
    ].join("\n");

    const result = await sendWhatsAppGroupMessage(
      client.grupo_wpp_jid,
      message,
    );

    if (result.success) {
      await sb.from("cron_runs").insert({
        job_name: `onboarding-wpp-${client.id}`,
        run_date: today,
      });
      sent++;
    }
  }

  return { sent, skipped };
}
