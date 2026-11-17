import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppGroupMessage } from "@/lib/weekly-reports/evolution-api";
import { formatDateBR } from "@/lib/datetime/timezone";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

interface MeetingRow {
  id: string;
  titulo: string;
  client_id: string;
  starts_at: string;
}

interface SummaryRow {
  resumo_geral: string;
  decisoes: string[] | null;
  proximos_passos: string[] | null;
}

interface ClientRow {
  nome: string;
  grupo_wpp_jid: string | null;
}

interface FollowupResult {
  sent: number;
  skipped: number;
  errors: string[];
}

function formatMessage(
  titulo: string,
  dataBr: string,
  summary: SummaryRow,
): string {
  const lines: string[] = [];

  lines.push(`📝 *Resumo da reunião*`);
  lines.push(``);
  lines.push(`🗓 *${titulo}* — ${dataBr}`);
  lines.push(``);
  lines.push(`📌 *Resumo:*`);
  lines.push(summary.resumo_geral);
  lines.push(``);

  const decisoes = summary.decisoes ?? [];
  if (decisoes.length > 0) {
    lines.push(`✅ *Decisões:*`);
    for (const d of decisoes) {
      lines.push(`• ${d}`);
    }
    lines.push(``);
  }

  const passos = summary.proximos_passos ?? [];
  if (passos.length > 0) {
    lines.push(`🎯 *Próximos passos:*`);
    for (const p of passos) {
      lines.push(`• ${p}`);
    }
    lines.push(``);
  }

  lines.push(`Qualquer dúvida, estamos à disposição! 🚀`);

  return lines.join("\n");
}

/**
 * Busca reuniões concluídas com resumo pronto e envia o resumo para o
 * grupo de WhatsApp do cliente (via Evolution API).
 *
 * Deduplicação por meeting: cada reunião enviada gera uma entrada em
 * `cron_runs` com job_name = `followup-reuniao-{meeting_id}`.
 */
export async function sendFollowupReuniao(): Promise<FollowupResult> {
  const sb = createServiceRoleClient() as SB;

  // 1. Buscar reuniões concluídas com resumo pronto e com client_id
  const { data: meetings, error: meetingsErr } = await sb
    .from("meetings")
    .select("id, titulo, client_id, starts_at")
    .eq("status", "completed")
    .eq("summary_ready", true)
    .not("client_id", "is", null)
    .is("deleted_at", null)
    .order("starts_at", { ascending: false });

  if (meetingsErr) {
    console.error("[followup-reuniao] Erro ao buscar meetings:", meetingsErr);
    return { sent: 0, skipped: 0, errors: [meetingsErr.message] };
  }

  const rows = (meetings ?? []) as MeetingRow[];
  if (rows.length === 0) {
    return { sent: 0, skipped: 0, errors: [] };
  }

  // 2. Filtrar as que já foram enviadas (cron_runs com job_name matching)
  const jobNames = rows.map((m) => `followup-reuniao-${m.id}`);
  const { data: existingRuns } = await sb
    .from("cron_runs")
    .select("job_name")
    .in("job_name", jobNames);

  const alreadySent = new Set(
    ((existingRuns ?? []) as { job_name: string }[]).map((r) => r.job_name),
  );

  const pending = rows.filter((m) => !alreadySent.has(`followup-reuniao-${m.id}`));
  if (pending.length === 0) {
    return { sent: 0, skipped: rows.length, errors: [] };
  }

  let sent = 0;
  const errors: string[] = [];

  for (const meeting of pending) {
    try {
      // 3. Buscar resumo da reunião
      const { data: summary } = await sb
        .from("meeting_summaries")
        .select("resumo_geral, decisoes, proximos_passos")
        .eq("meeting_id", meeting.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!summary?.resumo_geral) {
        continue;
      }

      // 4. Buscar dados do cliente
      const { data: client } = await sb
        .from("clients")
        .select("nome, grupo_wpp_jid")
        .eq("id", meeting.client_id)
        .maybeSingle();

      if (!client?.grupo_wpp_jid) {
        continue;
      }

      const typedSummary = summary as SummaryRow;
      const typedClient = client as ClientRow;

      // 5. Formatar e enviar mensagem
      const dataBr = formatDateBR(meeting.starts_at);
      const message = formatMessage(meeting.titulo, dataBr, typedSummary);

      const result = await sendWhatsAppGroupMessage(
        typedClient.grupo_wpp_jid!,
        message,
      );

      if (!result.success) {
        const errMsg = `meeting ${meeting.id}: ${result.error}`;
        console.error(`[followup-reuniao] ${errMsg}`);
        errors.push(errMsg);
        continue;
      }

      // 6. Marcar como enviado
      await sb.from("cron_runs").insert({
        job_name: `followup-reuniao-${meeting.id}`,
        run_date: new Date().toISOString().slice(0, 10),
      });

      sent++;
    } catch (err) {
      const errMsg = `meeting ${meeting.id}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`[followup-reuniao] ${errMsg}`);
      errors.push(errMsg);
    }
  }

  return { sent, skipped: alreadySent.size, errors };
}
