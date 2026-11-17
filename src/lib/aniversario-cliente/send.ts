import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppGroupMessage } from "@/lib/weekly-reports/evolution-api";
import { getTodayDate } from "@/lib/datetime/timezone";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export async function sendAniversarioCliente(): Promise<{
  sent: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient() as SB;
  const today = getTodayDate();
  const todayMD = today.slice(5); // "MM-DD"

  const { data: dates } = await sb
    .from("client_important_dates")
    .select("id, descricao, data, client_id, cliente:clients(nome, grupo_wpp_jid, contato_principal)")
    .eq("tipo", "aniversario_socio");

  let sent = 0;
  let skipped = 0;

  for (const d of dates ?? []) {
    const dateStr = d.data as string;
    if (!dateStr || dateStr.slice(5) !== todayMD) {
      continue;
    }

    const client = d.cliente as { nome: string; grupo_wpp_jid: string | null; contato_principal: string | null } | null;
    if (!client?.grupo_wpp_jid) {
      skipped++;
      continue;
    }

    const dedupKey = `aniversario-cliente-${d.id}-${today}`;
    const { data: already } = await sb
      .from("cron_runs")
      .select("ran_at")
      .eq("job_name", dedupKey)
      .maybeSingle();

    if (already) {
      skipped++;
      continue;
    }

    const nome = client.contato_principal || d.descricao || client.nome;

    const msg = [
      `🎂 *Feliz aniversário!*`,
      ``,
      `Hoje é um dia especial! Parabéns, *${nome}*! 🎉`,
      ``,
      `A equipe Yide Digital deseja muitas felicidades, saúde e sucesso! 🥳`,
      ``,
      `Que esse novo ano traga muitas conquistas! 🚀💙`,
    ].join("\n");

    const result = await sendWhatsAppGroupMessage(client.grupo_wpp_jid, msg);

    if (result.success) {
      await sb.from("cron_runs").insert({ job_name: dedupKey, run_date: today });
      sent++;
    }
  }

  return { sent, skipped };
}
