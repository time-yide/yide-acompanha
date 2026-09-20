import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppGroupMessage } from "@/lib/weekly-reports/evolution-api";
import {
  formatDateBR,
  formatTimeBR,
  getTodayDate,
  getDayBoundariesIso,
} from "@/lib/datetime/timezone";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

interface GravacaoEvent {
  id: string;
  titulo: string;
  inicio: string;
  client_id: string;
  localizacao_endereco: string | null;
  observacoes_gravacao: string | null;
}

interface ClientRow {
  nome: string;
  grupo_wpp_jid: string | null;
  contato_principal: string | null;
}

export async function sendLembreteGravacao(tipo: "vespera" | "dia"): Promise<{
  sent: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient() as SB;
  const today = getTodayDate();

  const targetDate = tipo === "vespera"
    ? (() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return getTodayDate(d);
      })()
    : today;

  const { fromIso, toIso } = getDayBoundariesIso(targetDate);

  const { data: events } = await sb
    .from("calendar_events")
    .select("id, titulo, inicio, client_id, localizacao_endereco, observacoes_gravacao")
    .eq("sub_calendar", "videomakers")
    .gte("inicio", fromIso)
    .lt("inicio", toIso)
    .is("deleted_at", null)
    .not("client_id", "is", null);

  const rows = (events ?? []) as GravacaoEvent[];
  let sent = 0;
  let skipped = 0;

  for (const ev of rows) {
    const { data: client } = await sb
      .from("clients")
      .select("nome, grupo_wpp_jid, contato_principal")
      .eq("id", ev.client_id)
      .maybeSingle();

    const c = client as ClientRow | null;
    if (!c?.grupo_wpp_jid) {
      skipped++;
      continue;
    }

    const dedupKey = `lembrete-gravacao-${tipo}-${ev.id}`;
    const { data: already } = await sb
      .from("cron_runs")
      .select("ran_at")
      .eq("job_name", dedupKey)
      .maybeSingle();

    if (already) {
      skipped++;
      continue;
    }

    const nome = c.contato_principal || c.nome;
    const dataBr = formatDateBR(ev.inicio);
    const horaBr = formatTimeBR(ev.inicio);

    const msg = tipo === "vespera"
      ? [
          `📹 *Lembrete: gravação amanhã!*`,
          ``,
          `Olá${nome ? `, *${nome}*` : ""}!`,
          ``,
          `Amanhã, *${dataBr}* às *${horaBr}*, temos uma gravação agendada:`,
          `🎬 *${ev.titulo}*`,
          ...(ev.localizacao_endereco ? [`📍 ${ev.localizacao_endereco}`] : []),
          ...(ev.observacoes_gravacao ? [`📝 ${ev.observacoes_gravacao}`] : []),
          ``,
          `Qualquer imprevisto, avise com antecedência! 🙏`,
        ].join("\n")
      : [
          `🎬 *Hoje é dia de gravação!*`,
          ``,
          `Olá${nome ? `, *${nome}*` : ""}!`,
          ``,
          `Gravação de hoje às *${horaBr}*:`,
          `📹 *${ev.titulo}*`,
          ...(ev.localizacao_endereco ? [`📍 ${ev.localizacao_endereco}`] : []),
          ...(ev.observacoes_gravacao ? [`📝 ${ev.observacoes_gravacao}`] : []),
          ``,
          `Nos vemos em breve! 🚀`,
        ].join("\n");

    const result = await sendWhatsAppGroupMessage(c.grupo_wpp_jid, msg);

    if (result.success) {
      await sb.from("cron_runs").insert({ job_name: dedupKey, run_date: today });
      sent++;
    }
  }

  return { sent, skipped };
}
